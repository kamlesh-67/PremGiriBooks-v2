import { Prisma, type Permission } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { isRetryableTransactionError } from "@/modules/roles/utils/prisma-errors";
import { hasOtherActiveFullCoverageRole } from "@/modules/roles/utils/role-coverage";
import { withRetry } from "@/modules/roles/utils/with-retry";
import type { AssignPermissionsResult, PermissionPair } from "@/types/role";

const SERIALIZABLE = { isolationLevel: Prisma.TransactionIsolationLevel.Serializable };
const CONFLICT_MESSAGE = "This role's permissions were changed by another request. Please try again.";

export const permissionRepository = {
  findCatalog(): Promise<Permission[]> {
    return prisma.permission.findMany({ orderBy: [{ module: "asc" }, { action: "asc" }] });
  },

  count(): Promise<number> {
    return prisma.permission.count();
  },

  async findRolePermissionIds(roleId: string): Promise<string[]> {
    const rows = await prisma.rolePermission.findMany({
      where: { roleId },
      select: { permissionId: true },
    });
    return rows.map((row) => row.permissionId);
  },

  // Idempotent — safe to run more than once, per 11-role-permissions.md's
  // "Seed default permissions... idempotent" requirement. Upsert on the
  // (module, action) unique index so re-running never creates duplicates.
  async ensureCatalog(pairs: PermissionPair[]): Promise<void> {
    for (const pair of pairs) {
      await prisma.permission.upsert({
        where: { module_action: { module: pair.module, action: pair.action } },
        update: {},
        create: { module: pair.module, action: pair.action },
      });
    }
  },

  // Additive only (skipDuplicates) — deliberately never removes a
  // RolePermission row. Re-running the seed script must not silently strip
  // permissions an Administrator has since customized through the
  // Permission Matrix UI; see permission-service.ts's seedDefaults().
  async seedRolePermissions(roleId: string, permissionIds: string[]): Promise<void> {
    if (permissionIds.length === 0) {
      return;
    }
    await prisma.rolePermission.createMany({
      data: permissionIds.map((permissionId) => ({ roleId, permissionId })),
      skipDuplicates: true,
    });
  },

  /**
   * Replaces a role's entire permission set inside one Serializable
   * transaction, guarding the same "at least one active full-coverage role
   * must remain per company" invariant role-repository.ts's deactivate()
   * enforces — removing full permission coverage from the last such role
   * has the identical end state (zero fully-privileged roles for this
   * company) without ever going through the dedicated deactivate path.
   * "Full coverage" means currently granted every permission in the
   * catalog, not merely named "Company Admin" — a custom role could also be
   * granted full access. Mandatory-permission-set enforcement for
   * `isProtected` roles is done by the caller (permission-service.ts)
   * before this is invoked, since it needs the DEFAULT_ROLE_PERMISSIONS
   * catalog mapping this repository layer has no business knowing about.
   */
  async assignToRole(
    roleId: string,
    companyId: string,
    permissionIds: string[]
  ): Promise<AssignPermissionsResult> {
    return withRetry(
      () =>
        prisma.$transaction(async (tx) => {
          const role = await tx.role.findUnique({
            where: { id: roleId },
            include: { _count: { select: { permissions: true } } },
          });
          if (!role || role.companyId !== companyId) {
            return { status: "not_found" };
          }

          const uniqueIds = Array.from(new Set(permissionIds));
          const totalPermissions = await tx.permission.count();
          const wasFullCoverage =
            totalPermissions > 0 && role._count.permissions === totalPermissions;
          const willBeFullCoverage = totalPermissions > 0 && uniqueIds.length === totalPermissions;

          if (role.isActive && wasFullCoverage && !willBeFullCoverage) {
            const stillHasFullCoverageRole = await hasOtherActiveFullCoverageRole(
              tx,
              companyId,
              roleId
            );
            if (!stillHasFullCoverageRole) {
              return { status: "last_full_coverage_role" };
            }
          }

          await tx.rolePermission.deleteMany({ where: { roleId } });
          if (uniqueIds.length > 0) {
            await tx.rolePermission.createMany({
              data: uniqueIds.map((permissionId) => ({ roleId, permissionId })),
            });
          }

          return { status: "ok" };
        }, SERIALIZABLE),
      isRetryableTransactionError,
      CONFLICT_MESSAGE
    );
  },
};
