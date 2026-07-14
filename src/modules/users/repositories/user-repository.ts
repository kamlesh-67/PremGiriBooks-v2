import { Prisma, type Role } from "@prisma/client";

import { AppError } from "@/lib/app-error";
import { logger } from "@/lib/logger";
import { prisma } from "@/lib/prisma";
import { runInTransaction } from "@/lib/transaction";
import { COMPANY_ADMIN_ROLE_NAME } from "@/constants/roles";
import { isFullCoverageRole } from "@/modules/roles/utils/role-coverage";
import type { UserProfileFields } from "@/modules/users/utils/normalize-user-input";
import { isRetryableTransactionError } from "@/modules/users/utils/prisma-errors";
import type {
  CompanyAdminSummary,
  CreateUserResult,
  DeactivateUserResult,
  ReassignCompanyResult,
  SetActiveByIdResult,
  UpdateUserResult,
  UserListFilters,
  UserWithRole,
} from "@/types/user";

// Every row this repository returns belongs to a COMPANY-type user, which
// always has a companyId and a Role by construction (userService.createUser/
// updateUser only ever assign a real, company-scoped roleId) — the schema
// types these as nullable only to support PLATFORM users, which this module
// never touches. Null here would be a genuine data-integrity bug, not a
// normal business outcome, so this throws rather than returning a fuzzy
// result.
function assertHasRole<T extends { role: Role | null; companyId: string | null }>(
  user: T
): T & { role: Role; companyId: string } {
  if (!user.role || !user.companyId) {
    throw new AppError("Data integrity error: a company user must have a company and a role assigned.");
  }
  return user as T & { role: Role; companyId: string };
}

const SAFE_INCLUDE = { role: true } as const;
const SAFE_OMIT = { passwordHash: true } as const;

const CONFLICT_MESSAGE = "This user was changed by another request. Please try again.";

/**
 * Serializable isolation alone only detects a write-skew conflict, it
 * doesn't resolve it, so the "last active Administrator" count-then-write in
 * create/updateProfile/deactivate needs a bounded retry the same way "only
 * one current financial year" does. Logs each retry and, if retries are
 * exhausted, logs that too — otherwise repeated write-skew contention on
 * this table would be invisible to anything but the end user's error toast.
 */
const SERIALIZABLE_RETRY = {
  isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
  retryable: isRetryableTransactionError,
  conflictMessage: CONFLICT_MESSAGE,
  onRetry: (attempt: number, maxAttempts: number) =>
    logger.warn({ attempt, maxAttempts }, "Retrying user transaction after a write-skew conflict"),
  onRetriesExhausted: (attempt: number, maxAttempts: number) =>
    logger.error(
      { attempt, maxAttempts },
      "User transaction retries exhausted after repeated write-skew conflicts"
    ),
};

function buildWhere(companyId: string, filters: UserListFilters): Prisma.UserWhereInput {
  const where: Prisma.UserWhereInput = { companyId };

  if (filters.search) {
    const search = filters.search;
    where.OR = [
      { username: { contains: search, mode: "insensitive" } },
      { fullName: { contains: search, mode: "insensitive" } },
      { email: { contains: search, mode: "insensitive" } },
      { role: { name: { contains: search, mode: "insensitive" } } },
    ];
  }

  return where;
}

export const userRepository = {
  async findMany(companyId: string, filters: UserListFilters): Promise<UserWithRole[]> {
    const users = await prisma.user.findMany({
      where: buildWhere(companyId, filters),
      include: SAFE_INCLUDE,
      omit: SAFE_OMIT,
      orderBy: { fullName: "asc" },
    });
    // A single malformed row (missing role/companyId — a data-integrity bug,
    // not a normal outcome) must not take down the whole list page. Isolate
    // and drop it here instead of letting assertHasRole's throw propagate
    // across every other, valid row in the result.
    return users.flatMap((user) => {
      try {
        return [assertHasRole(user)];
      } catch {
        logger.error({ userId: user.id }, "Skipping malformed user row missing role or companyId");
        return [];
      }
    });
  },

  // Callers must always treat "found but belongs to a different company" the
  // same as "not found" — findById on its own does not enforce tenant
  // isolation, since the caller's own companyId isn't known at this layer.
  async findById(
    id: string,
    client: Prisma.TransactionClient | typeof prisma = prisma
  ): Promise<UserWithRole | null> {
    const user = await client.user.findUnique({
      where: { id },
      include: SAFE_INCLUDE,
      omit: SAFE_OMIT,
    });
    return user ? assertHasRole(user) : null;
  },

  // The only two places passwordHash is allowed to leave this file's own
  // scope: reading it to verify a self-service password change, and writing
  // a freshly-hashed replacement. Every other query in this repository
  // omits it (SAFE_OMIT), per the "passwordHash never leaves the repository
  // layer" rule established in feature-spec 10.
  async findPasswordHashById(id: string): Promise<string | null> {
    const user = await prisma.user.findUnique({ where: { id }, select: { passwordHash: true } });
    return user?.passwordHash ?? null;
  },

  async updatePasswordHash(
    id: string,
    passwordHash: string,
    client: Prisma.TransactionClient | typeof prisma = prisma
  ): Promise<void> {
    await client.user.update({ where: { id }, data: { passwordHash } });
  },

  /**
   * Checks the selected role's existence, active status, and — new for the
   * per-company role split — that it actually belongs to `companyId`
   * (previously unnecessary, since Role was a single global table; now a
   * client-supplied roleId from another company must be rejected the same
   * way an inactive one is) inside the same Serializable transaction as the
   * insert, closing the TOCTOU window a separate pre-write check in the
   * service layer left open: without this, a role could be deactivated by
   * another request in the gap between userService.createUser's check and
   * this write, letting a brand-new user end up assigned to an inactive
   * role despite the check having passed.
   *
   * Accepts an optional external transaction client, mirroring the exact
   * convention ledgerRepository.update()/companyRepository.create() already
   * use — companyService.createCompany() calls this from inside its own
   * transaction so the brand-new Company Admin User row commits (or rolls
   * back) atomically with the Company/Role/FinancialYear/Ledger rows.
   * Defaults to opening its own Serializable-isolation, retrying
   * transaction (via runInTransaction) for every other (non-transactional)
   * caller, unchanged from before.
   */
  create(
    companyId: string,
    profile: UserProfileFields,
    passwordHash: string,
    externalTx?: Prisma.TransactionClient
  ): Promise<CreateUserResult> {
    const run = async (tx: Prisma.TransactionClient): Promise<CreateUserResult> => {
      const role = await tx.role.findUnique({ where: { id: profile.roleId } });
      if (!role || role.companyId !== companyId) {
        return { status: "invalid_role" };
      }
      if (!role.isActive) {
        return { status: "inactive_role" };
      }

      const user = await tx.user.create({
        data: { ...profile, passwordHash, companyId },
        include: SAFE_INCLUDE,
        omit: SAFE_OMIT,
      });

      return { status: "ok", user: assertHasRole(user) };
    };

    if (externalTx) {
      return run(externalTx);
    }
    return runInTransaction(run, SERIALIZABLE_RETRY);
  },

  /**
   * Bundles four things into one Serializable transaction: the
   * tenant-isolation check (the target must belong to `companyId`), the
   * profile/password write, and the "at least one active user holding a
   * full-coverage role must remain" guard — the same invariant
   * `deactivate()` enforces, applied here because reassigning a
   * full-coverage user's role away from full coverage has the identical
   * effect (zero such active users left) without ever going through the
   * dedicated deactivate path. This is name-independent (isFullCoverageRole
   * checks permission count, not "is this role named Company Admin") —
   * see role-coverage.ts. runInTransaction's Serializable + retry option closes the write-skew
   * race where two concurrent role-reassignments away from full coverage
   * could each see the other's row as still-active and both pass the count
   * check.
   */
  async updateProfile(
    id: string,
    companyId: string,
    profile: UserProfileFields,
    passwordHash: string | undefined
  ): Promise<UpdateUserResult> {
    return runInTransaction(async (tx) => {
      const existingRaw = await tx.user.findUnique({
        where: { id },
        include: SAFE_INCLUDE,
        omit: SAFE_OMIT,
      });
      if (!existingRaw || existingRaw.companyId !== companyId) {
        return { status: "not_found" };
      }
      const existing = assertHasRole(existingRaw);

      // Only checked when the role is actually changing — a no-op
      // resubmission of the user's own already-inactive role (the Edit
      // page merges it back into the Select for exactly this case) must
      // keep working, per 11-role-permissions.md's "existing users keep
      // functioning under a deactivated role" rule. Checked inside this
      // same Serializable transaction, not a separate pre-write read, to
      // close the identical TOCTOU window documented on create() above.
      if (profile.roleId !== existing.roleId) {
        const newRole = await tx.role.findUnique({ where: { id: profile.roleId } });
        if (!newRole || newRole.companyId !== companyId) {
          return { status: "invalid_role" };
        }
        if (!newRole.isActive) {
          return { status: "inactive_role" };
        }
      }

      const losesFullCoverage =
        existing.isActive &&
        profile.roleId !== existing.roleId &&
        (await isFullCoverageRole(tx, existing.role.id));

      if (losesFullCoverage) {
        const stillHasOtherFullCoverageUser = await hasOtherActiveFullCoverageUser(
          tx,
          companyId,
          id
        );
        if (!stillHasOtherFullCoverageUser) {
          return { status: "last_active_admin" };
        }
      }

      const updated = await tx.user.update({
        where: { id },
        data: { ...profile, ...(passwordHash ? { passwordHash } : {}) },
        include: SAFE_INCLUDE,
        omit: SAFE_OMIT,
      });

      return { status: "ok", user: assertHasRole(updated) };
    }, SERIALIZABLE_RETRY);
  },

  async setActive(id: string, companyId: string, isActive: boolean): Promise<UserWithRole | null> {
    return runInTransaction(async (tx) => {
      const existing = await tx.user.findUnique({ where: { id } });
      if (!existing || existing.companyId !== companyId) {
        return null;
      }

      const updated = await tx.user.update({
        where: { id },
        data: { isActive },
        include: SAFE_INCLUDE,
        omit: SAFE_OMIT,
      });
      return assertHasRole(updated);
    });
  },

  // Platform-only (cross-company) profile update for the Administration
  // module's Company Admins screen — "complete edit" of username/fullName/
  // email/mobile, distinct from setActiveById (status) and
  // updatePasswordHash (password). Gated one layer up in
  // platform-user-service.ts, never here, same as its siblings below.
  async updateProfileFieldsById(
    id: string,
    fields: { username: string; fullName: string; email: string; mobile: string | null },
    client: Prisma.TransactionClient | typeof prisma = prisma
  ): Promise<UserWithRole | null> {
    try {
      const updated = await client.user.update({
        where: { id },
        data: fields,
        include: SAFE_INCLUDE,
        omit: SAFE_OMIT,
      });
      return assertHasRole(updated);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
        return null;
      }
      throw error;
    }
  },

  /**
   * Platform-only (cross-company) reassignment of a Company Admin to a
   * different company — moves both companyId and roleId together, since
   * Role is per-company (their old roleId doesn't exist in the target
   * company). Assigns them the target company's own Company Admin role
   * (looked up by name, not carried over by id) rather than leaving them
   * roleless. Rejects a target company that's inactive, same as every other
   * "can't act on/into a deactivated company" rule elsewhere in this
   * codebase. Enforces the same "at least one active full-coverage user
   * must remain per company" invariant setActiveById/deactivate() do,
   * against the *source* company — reassigning away has the identical
   * end-state (one fewer active full-coverage user there) as deactivating.
   * Callers must pass the transaction client they're already inside
   * (platformUserService wraps this in a Serializable transaction), same
   * requirement as setActiveById.
   */
  async reassignCompanyById(
    id: string,
    targetCompanyId: string,
    client: Prisma.TransactionClient | typeof prisma = prisma
  ): Promise<ReassignCompanyResult> {
    const existingRaw = await client.user.findUnique({
      where: { id },
      include: SAFE_INCLUDE,
      omit: SAFE_OMIT,
    });
    if (!existingRaw) {
      return { status: "not_found" };
    }
    const existing = assertHasRole(existingRaw);

    if (existing.companyId === targetCompanyId) {
      return { status: "same_company" };
    }

    const targetCompany = await client.company.findUnique({ where: { id: targetCompanyId } });
    if (!targetCompany) {
      return { status: "target_company_not_found" };
    }
    if (!targetCompany.isActive) {
      return { status: "target_company_inactive" };
    }

    const targetRole = await client.role.findUnique({
      where: { companyId_name: { companyId: targetCompanyId, name: COMPANY_ADMIN_ROLE_NAME } },
    });
    if (!targetRole) {
      return { status: "target_role_not_found" };
    }

    if (existing.isActive) {
      const isFullCoverage = await isFullCoverageRole(client, existing.role.id);
      if (isFullCoverage) {
        const stillHasOtherFullCoverageUser = await hasOtherActiveFullCoverageUser(
          client,
          existing.companyId,
          id
        );
        if (!stillHasOtherFullCoverageUser) {
          return { status: "last_active_admin" };
        }
      }
    }

    const updated = await client.user.update({
      where: { id },
      data: { companyId: targetCompanyId, roleId: targetRole.id },
      include: SAFE_INCLUDE,
      omit: SAFE_OMIT,
    });
    return { status: "ok", user: assertHasRole(updated), previousCompanyId: existing.companyId };
  },

  // The Platform-only (cross-company) exceptions to this repository's
  // "every method takes companyId" rule — reads/writes any Company Admin
  // regardless of which company they belong to, for the Administration
  // module's Company Admins screen. Gated by assertSuperAdmin() one layer
  // up, in platform-user-service.ts, never here (Permanent Architecture
  // Principle 3 — repositories never perform authorization).
  async findAllCompanyAdmins(): Promise<CompanyAdminSummary[]> {
    const users = await prisma.user.findMany({
      where: { userType: "COMPANY", role: { isProtected: true, name: COMPANY_ADMIN_ROLE_NAME } },
      select: {
        id: true,
        username: true,
        fullName: true,
        email: true,
        mobile: true,
        isActive: true,
        companyId: true,
        company: { select: { companyName: true } },
      },
      orderBy: { fullName: "asc" },
    });

    return users
      .filter((user): user is typeof user & { companyId: string; company: { companyName: string } } =>
        Boolean(user.companyId && user.company)
      )
      .map((user) => ({
        id: user.id,
        username: user.username,
        fullName: user.fullName,
        email: user.email,
        mobile: user.mobile,
        isActive: user.isActive,
        companyId: user.companyId,
        companyName: user.company.companyName,
      }));
  },

  /**
   * Platform-only (cross-company) activate/deactivate, backing
   * platformUserService.setCompanyAdminActive. Deactivating enforces the
   * same "at least one active user with full permission-catalog coverage
   * must remain per company" invariant deactivate()/updateProfile() already
   * enforce — without it, a Super Admin could deactivate every Company
   * Admin in a company via /administration/company-admins, leaving it
   * completely unadministrable with no in-app recovery path. Callers must
   * pass the transaction client they're already inside (platformUserService
   * wraps this in a Serializable transaction) so the count-then-write check
   * below is race-free — this is not itself a Serializable transaction.
   */
  async setActiveById(
    id: string,
    isActive: boolean,
    client: Prisma.TransactionClient | typeof prisma = prisma
  ): Promise<SetActiveByIdResult> {
    const existingRaw = await client.user.findUnique({
      where: { id },
      include: SAFE_INCLUDE,
      omit: SAFE_OMIT,
    });
    if (!existingRaw) {
      return { status: "not_found" };
    }
    const existing = assertHasRole(existingRaw);

    if (!isActive && existing.isActive) {
      const isFullCoverage = await isFullCoverageRole(client, existing.role.id);
      if (isFullCoverage) {
        const stillHasOtherFullCoverageUser = await hasOtherActiveFullCoverageUser(
          client,
          existing.companyId,
          id
        );
        if (!stillHasOtherFullCoverageUser) {
          return { status: "last_active_admin" };
        }
      }
    }

    try {
      const updated = await client.user.update({
        where: { id },
        data: { isActive },
        include: SAFE_INCLUDE,
        omit: SAFE_OMIT,
      });
      return { status: "ok", user: assertHasRole(updated) };
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
        return { status: "not_found" };
      }
      throw error;
    }
  },

  /**
   * Deactivation bundles the tenant-isolation check, the "last active
   * full-coverage user" check, and the "not self" business-rule check into
   * the same Serializable transaction as the write. runInTransaction's
   * Serializable + retry option closes the write-skew race two independent
   * count-then-write queries would otherwise leave open — e.g. two
   * full-coverage users, X and Y, deactivating each other at nearly the same
   * moment: under plain Read Committed each transaction's count would see
   * the other still active and both would pass, leaving zero active
   * full-coverage users. Serializable isolation makes Postgres abort one of
   * the two with a write-skew conflict, which the retry option surfaces as
   * "please try again" rather than silently allowing it.
   */
  async deactivate(
    id: string,
    companyId: string,
    requestedById: string
  ): Promise<DeactivateUserResult> {
    return runInTransaction(async (tx) => {
      const userRaw = await tx.user.findUnique({
        where: { id },
        include: SAFE_INCLUDE,
        omit: SAFE_OMIT,
      });
      if (!userRaw || userRaw.companyId !== companyId) {
        return { status: "not_found" };
      }
      const user = assertHasRole(userRaw);

      if (id === requestedById) {
        return { status: "self" };
      }

      if (user.isActive && (await isFullCoverageRole(tx, user.role.id))) {
        const stillHasOtherFullCoverageUser = await hasOtherActiveFullCoverageUser(
          tx,
          user.companyId,
          id
        );

        if (!stillHasOtherFullCoverageUser) {
          return { status: "last_active_admin" };
        }
      }

      const updated = await tx.user.update({
        where: { id },
        data: { isActive: false },
        include: SAFE_INCLUDE,
        omit: SAFE_OMIT,
      });

      return { status: "ok", user: assertHasRole(updated) };
    }, SERIALIZABLE_RETRY);
  },
};

/**
 * Whether at least one *other* active user in the company holds a
 * full-coverage role (excluding `excludeUserId`) — the user-level half of
 * the same structural, name-independent invariant role-coverage.ts's
 * hasOtherActiveFullCoverageRole enforces at the role level. In practice
 * this always protects the Company Admin seat, since that role is always
 * full-coverage and can never itself be deactivated (isProtected) — but
 * the check itself never compares a role's name.
 */
async function hasOtherActiveFullCoverageUser(
  tx: Prisma.TransactionClient | typeof prisma,
  companyId: string,
  excludeUserId: string
): Promise<boolean> {
  const totalPermissions = await tx.permission.count();
  if (totalPermissions === 0) {
    return true;
  }

  const otherActiveUsers = await tx.user.findMany({
    where: { companyId, isActive: true, id: { not: excludeUserId } },
    select: { role: { select: { _count: { select: { permissions: true } } } } },
  });

  return otherActiveUsers.some((u) => u.role?._count.permissions === totalPermissions);
}
