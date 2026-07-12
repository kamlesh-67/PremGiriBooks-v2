import { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import type { UserProfileFields } from "@/modules/users/utils/normalize-user-input";
import { isRetryableTransactionError } from "@/modules/users/utils/prisma-errors";
import type {
  DeactivateUserResult,
  UpdateUserResult,
  UserListFilters,
  UserWithRole,
} from "@/types/user";

const SAFE_INCLUDE = { role: true } as const;
const SAFE_OMIT = { passwordHash: true } as const;

const MAX_TRANSACTION_RETRIES = 3;
const SERIALIZABLE = { isolationLevel: Prisma.TransactionIsolationLevel.Serializable };
const CONFLICT_MESSAGE = "This user was changed by another request. Please try again.";

/**
 * Mirrors financial-year-repository.ts's withRetry — Serializable isolation
 * alone only detects a write-skew conflict, it doesn't resolve it, so the
 * "last active Administrator" count-then-write in updateProfile/deactivate
 * needs a bounded retry the same way "only one current financial year" does.
 */
async function withRetry<T>(operation: () => Promise<T>): Promise<T> {
  for (let attempt = 1; attempt <= MAX_TRANSACTION_RETRIES; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      if (!isRetryableTransactionError(error) || attempt === MAX_TRANSACTION_RETRIES) {
        if (isRetryableTransactionError(error)) {
          throw new Error(CONFLICT_MESSAGE);
        }
        throw error;
      }
    }
  }

  throw new Error(CONFLICT_MESSAGE);
}

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
  findMany(companyId: string, filters: UserListFilters): Promise<UserWithRole[]> {
    return prisma.user.findMany({
      where: buildWhere(companyId, filters),
      include: SAFE_INCLUDE,
      omit: SAFE_OMIT,
      orderBy: { fullName: "asc" },
    });
  },

  // Callers must always treat "found but belongs to a different company" the
  // same as "not found" — findById on its own does not enforce tenant
  // isolation, since the caller's own companyId isn't known at this layer.
  findById(id: string): Promise<UserWithRole | null> {
    return prisma.user.findUnique({
      where: { id },
      include: SAFE_INCLUDE,
      omit: SAFE_OMIT,
    });
  },

  create(
    companyId: string,
    profile: UserProfileFields,
    passwordHash: string
  ): Promise<UserWithRole> {
    return prisma.user.create({
      data: { ...profile, passwordHash, companyId },
      include: SAFE_INCLUDE,
      omit: SAFE_OMIT,
    });
  },

  /**
   * Bundles four things into one Serializable transaction: the
   * tenant-isolation check (the target must belong to `companyId`), the
   * profile/password write, and the "at least one active Administrator must
   * remain" guard — the same invariant `deactivate()` enforces, applied here
   * because reassigning an Administrator's role away from Administrator has
   * the identical effect (zero active Administrators left) without ever
   * going through the dedicated deactivate path. Serializable + withRetry
   * closes the write-skew race where two concurrent role-reassignments away
   * from Administrator could each see the other's Administrator row as
   * still-active and both pass the count check.
   */
  async updateProfile(
    id: string,
    companyId: string,
    profile: UserProfileFields,
    passwordHash: string | undefined
  ): Promise<UpdateUserResult> {
    return withRetry(() =>
      prisma.$transaction(async (tx) => {
        const existing = await tx.user.findUnique({
          where: { id },
          include: SAFE_INCLUDE,
          omit: SAFE_OMIT,
        });
        if (!existing || existing.companyId !== companyId) {
          return { status: "not_found" };
        }

        const losesAdministratorRole =
          existing.isActive &&
          existing.role.name === "Administrator" &&
          profile.roleId !== existing.roleId;

        if (losesAdministratorRole) {
          const otherActiveAdministrators = await tx.user.count({
            where: {
              companyId: existing.companyId,
              roleId: existing.roleId,
              isActive: true,
              id: { not: id },
            },
          });

          if (otherActiveAdministrators === 0) {
            return { status: "last_administrator" };
          }
        }

        const updated = await tx.user.update({
          where: { id },
          data: { ...profile, ...(passwordHash ? { passwordHash } : {}) },
          include: SAFE_INCLUDE,
          omit: SAFE_OMIT,
        });

        return { status: "ok", user: updated };
      }, SERIALIZABLE)
    );
  },

  async setActive(id: string, companyId: string, isActive: boolean): Promise<UserWithRole | null> {
    return prisma.$transaction(async (tx) => {
      const existing = await tx.user.findUnique({ where: { id } });
      if (!existing || existing.companyId !== companyId) {
        return null;
      }

      return tx.user.update({
        where: { id },
        data: { isActive },
        include: SAFE_INCLUDE,
        omit: SAFE_OMIT,
      });
    });
  },

  /**
   * Deactivation bundles the tenant-isolation check, the "last active
   * Administrator" check, and the "not self" business-rule check into the
   * same Serializable transaction as the write. Serializable + withRetry
   * closes the write-skew race two independent count-then-write queries
   * would otherwise leave open — e.g. two Administrators, X and Y,
   * deactivating each other at nearly the same moment: under plain Read
   * Committed each transaction's count would see the other still active and
   * both would pass, leaving zero active Administrators. Serializable
   * isolation makes Postgres abort one of the two with a write-skew
   * conflict, which withRetry surfaces as "please try again" rather than
   * silently allowing it.
   */
  async deactivate(
    id: string,
    companyId: string,
    requestedById: string
  ): Promise<DeactivateUserResult> {
    return withRetry(() =>
      prisma.$transaction(async (tx) => {
        const user = await tx.user.findUnique({
          where: { id },
          include: SAFE_INCLUDE,
          omit: SAFE_OMIT,
        });
        if (!user || user.companyId !== companyId) {
          return { status: "not_found" };
        }

        if (id === requestedById) {
          return { status: "self" };
        }

        if (user.isActive && user.role.name === "Administrator") {
          const otherActiveAdministrators = await tx.user.count({
            where: {
              companyId: user.companyId,
              roleId: user.roleId,
              isActive: true,
              id: { not: id },
            },
          });

          if (otherActiveAdministrators === 0) {
            return { status: "last_administrator" };
          }
        }

        const updated = await tx.user.update({
          where: { id },
          data: { isActive: false },
          include: SAFE_INCLUDE,
          omit: SAFE_OMIT,
        });

        return { status: "ok", user: updated };
      }, SERIALIZABLE)
    );
  },
};
