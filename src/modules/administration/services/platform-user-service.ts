import { AppError } from "@/lib/app-error";
import { getCurrentSuperAdmin } from "@/lib/current-user";
import { hashPassword } from "@/lib/password";
import { prisma } from "@/lib/prisma";
import { COMPANY_ADMIN_ROLE_NAME } from "@/constants/roles";
import { auditLogService } from "@/modules/administration/services/audit-log-service";
import { userRepository } from "@/modules/users/repositories/user-repository";
import type { CompanyAdminSummary, UserWithRole } from "@/types/user";

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

export const platformUserService = {
  async listCompanyAdmins(): Promise<CompanyAdminSummary[]> {
    await getCurrentSuperAdmin();
    return userRepository.findAllCompanyAdmins();
  },

  async resetCompanyAdminPassword(userId: string, newPassword: string): Promise<void> {
    const actor = await getCurrentSuperAdmin();

    const user = await userRepository.findById(userId);
    if (!user) {
      throw new AppError("Company Admin not found.");
    }
    assertIsCompanyAdmin(user);

    const passwordHash = await hashPassword(newPassword);

    await prisma.$transaction(async (tx) => {
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
    });
  },

  async setCompanyAdminActive(userId: string, isActive: boolean): Promise<void> {
    const actor = await getCurrentSuperAdmin();

    const existing = await userRepository.findById(userId);
    if (!existing) {
      throw new AppError("Company Admin not found.");
    }
    assertIsCompanyAdmin(existing);

    await prisma.$transaction(async (tx) => {
      const user = await userRepository.setActiveById(userId, isActive, tx);
      if (!user) {
        throw new AppError("Company Admin not found.");
      }
      await auditLogService.record(
        {
          actorUserId: actor.id,
          action: isActive ? "company_admin.activated" : "company_admin.deactivated",
          targetType: "User",
          targetId: userId,
          companyId: user.companyId,
        },
        tx
      );
    });
  },
};
