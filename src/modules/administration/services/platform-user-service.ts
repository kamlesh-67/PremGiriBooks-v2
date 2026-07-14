import { Prisma } from "@prisma/client";

import { AppError } from "@/lib/app-error";
import { getCurrentSuperAdmin } from "@/lib/current-user";
import { hashPassword } from "@/lib/password";
import { runInTransaction } from "@/lib/transaction";
import { COMPANY_ADMIN_ROLE_NAME } from "@/constants/roles";
import { auditLogService } from "@/modules/administration/services/audit-log-service";
import {
  saveCompanyAdminSchema,
  type SaveCompanyAdminInput,
} from "@/modules/administration/validation/create-company-schema";
import { userRepository } from "@/modules/users/repositories/user-repository";
import { getUniqueConstraintFields, isRetryableTransactionError } from "@/modules/users/utils/prisma-errors";
import type { CompanyAdminSummary, UserWithRole } from "@/types/user";

const CONFLICT_MESSAGE = "This Company Admin was changed by another request. Please try again.";
const SERIALIZABLE_RETRY = {
  isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
  retryable: isRetryableTransactionError,
  conflictMessage: CONFLICT_MESSAGE,
};

/**
 * Super-Admin-only, cross-company Company Admin management — "Reset
 * Company Admin password" and activate/deactivate, per
 * architecture-Migration-Super-Admin-Administration.md's Super Admin
 * capability list. Deliberately not "create an additional Company Admin
 * for an existing company" — that's already possible through the existing
 * per-company User Management edit-role flow once Company Admin is just a
 * regular (if protected) role; not duplicated here.
 */

// Both mutations below only ever operate on Company Admins — matches the
// filter findAllCompanyAdmins() (the read path backing this screen) already
// applies. Without this, a Super Admin supplying any regular employee's user
// id (not just a Company Admin's) could silently reset that employee's
// password or deactivate their account, exceeding this service's documented
// scope.
function assertIsCompanyAdmin(user: UserWithRole): void {
  if (!user.role.isProtected || user.role.name !== COMPANY_ADMIN_ROLE_NAME) {
    throw new AppError("Company Admin not found.");
  }
}

function translateCompanyAdminPersistError(error: unknown): never {
  const fields = getUniqueConstraintFields(error);
  if (fields.includes("username")) {
    throw new AppError("That username is already taken.");
  }
  if (fields.includes("email")) {
    throw new AppError("That email is already registered.");
  }
  throw error;
}

export const platformUserService = {
  async listCompanyAdmins(): Promise<CompanyAdminSummary[]> {
    await getCurrentSuperAdmin();
    return userRepository.findAllCompanyAdmins();
  },

  async resetCompanyAdminPassword(userId: string, newPassword: string): Promise<void> {
    const actor = await getCurrentSuperAdmin();

    // Cheap upfront check so a bogus id fails fast without opening a
    // transaction — re-verified below, inside the transaction, immediately
    // before the write, since this initial read is not itself race-free.
    const precheck = await userRepository.findById(userId);
    if (!precheck) {
      throw new AppError("Company Admin not found.");
    }
    assertIsCompanyAdmin(precheck);

    const passwordHash = await hashPassword(newPassword);

    await runInTransaction(async (tx) => {
      // Re-read and re-validate inside the transaction, immediately before
      // mutating — closes the TOCTOU window between the precheck above and
      // this write, where a concurrent request could have changed the
      // target's role in between.
      const user = await userRepository.findById(userId, tx);
      if (!user) {
        throw new AppError("Company Admin not found.");
      }
      assertIsCompanyAdmin(user);

      await userRepository.updatePasswordHash(userId, passwordHash, tx);
      await auditLogService.record(
        {
          actorUserId: actor.id,
          action: "company_admin.password_reset",
          targetType: "User",
          targetId: userId,
          companyId: user.companyId,
        },
        tx
      );
    }, SERIALIZABLE_RETRY);
  },

  /**
   * Replaces the previous separate updateCompanyAdminProfile()/
   * reassignCompanyAdmin() methods, which the Company Admins edit panel
   * called as two independent (and independently non-atomic) requests — a
   * profile save that succeeded followed by a reassignment that failed
   * would silently leave the admin renamed but not moved. Both effects now
   * happen inside one Serializable transaction: the profile fields are
   * always updated, and a company reassignment additionally runs (and gets
   * its own audit entry) only when the submitted companyId differs from the
   * admin's current one, so a failure at either step rolls back both.
   */
  async saveCompanyAdmin(userId: string, input: SaveCompanyAdminInput): Promise<void> {
    const actor = await getCurrentSuperAdmin();
    const data = saveCompanyAdminSchema.parse(input);

    const precheck = await userRepository.findById(userId);
    if (!precheck) {
      throw new AppError("Company Admin not found.");
    }
    assertIsCompanyAdmin(precheck);

    await runInTransaction(async (tx) => {
      // Same TOCTOU close as the other mutations above.
      const existing = await userRepository.findById(userId, tx);
      if (!existing) {
        throw new AppError("Company Admin not found.");
      }
      assertIsCompanyAdmin(existing);

      let updated;
      try {
        updated = await userRepository.updateProfileFieldsById(
          userId,
          {
            username: data.username,
            fullName: data.fullName,
            email: data.email,
            mobile: data.mobile ? data.mobile : null,
          },
          tx
        );
      } catch (error) {
        translateCompanyAdminPersistError(error);
      }
      if (!updated) {
        throw new AppError("Company Admin not found.");
      }

      await auditLogService.record(
        {
          actorUserId: actor.id,
          action: "company_admin.updated",
          targetType: "User",
          targetId: userId,
          companyId: updated.companyId,
        },
        tx
      );

      if (data.companyId === existing.companyId) {
        return;
      }

      const result = await userRepository.reassignCompanyById(userId, data.companyId, tx);
      switch (result.status) {
        case "not_found":
          throw new AppError("Company Admin not found.");
        case "same_company":
          return;
        case "target_company_not_found":
          throw new AppError("Target company not found.");
        case "target_company_inactive":
          throw new AppError("Target company is not active.");
        case "target_role_not_found":
          throw new AppError("Target company has no Company Admin role.");
        case "last_active_admin":
          throw new AppError(
            "At least one active Company Admin must remain for the current company."
          );
        case "ok":
          break;
      }

      await auditLogService.record(
        {
          actorUserId: actor.id,
          action: "company_admin.reassigned",
          targetType: "User",
          targetId: userId,
          companyId: data.companyId,
          metadata: { fromCompanyId: result.previousCompanyId, toCompanyId: data.companyId },
        },
        tx
      );
    }, SERIALIZABLE_RETRY);
  },

  async setCompanyAdminActive(userId: string, isActive: boolean): Promise<void> {
    const actor = await getCurrentSuperAdmin();

    const precheck = await userRepository.findById(userId);
    if (!precheck) {
      throw new AppError("Company Admin not found.");
    }
    assertIsCompanyAdmin(precheck);

    await runInTransaction(async (tx) => {
      // Same TOCTOU close as resetCompanyAdminPassword above — re-fetch and
      // re-validate inside the transaction right before mutating.
      const existing = await userRepository.findById(userId, tx);
      if (!existing) {
        throw new AppError("Company Admin not found.");
      }
      assertIsCompanyAdmin(existing);

      const result = await userRepository.setActiveById(userId, isActive, tx);
      if (result.status === "not_found") {
        throw new AppError("Company Admin not found.");
      }
      if (result.status === "last_active_admin") {
        throw new AppError("At least one active Company Admin must remain for this company.");
      }

      await auditLogService.record(
        {
          actorUserId: actor.id,
          action: isActive ? "company_admin.activated" : "company_admin.deactivated",
          targetType: "User",
          targetId: userId,
          companyId: result.user.companyId,
        },
        tx
      );
    }, SERIALIZABLE_RETRY);
  },
};
