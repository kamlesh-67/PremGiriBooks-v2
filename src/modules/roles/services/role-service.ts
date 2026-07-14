import type { Prisma, Role } from "@prisma/client";

import { toActionErrorMessage } from "@/lib/action-error";
import { AppError } from "@/lib/app-error";
import { getCurrentCompanyUser } from "@/lib/current-user";
import { assertPermission } from "@/lib/permissions";
import { COMPANY_ADMIN_ROLE_NAME } from "@/constants/roles";
import { DEFAULT_ROLE_PERMISSIONS } from "@/constants/permissions";
import { roleRepository } from "@/modules/roles/repositories/role-repository";
import { isUniqueConstraintError } from "@/modules/roles/utils/prisma-errors";
import { roleSchema, type RoleFormInput } from "@/modules/roles/validation/role-schema";
import type { RoleWithPermissionCount } from "@/types/role";

function translateRolePersistError(error: unknown): never {
  if (isUniqueConstraintError(error)) {
    throw new AppError("A role with this name already exists.");
  }

  // Routes through the shared Server Action translator so an unexpected
  // persistence failure is logged server-side (via the Pino logger) instead
  // of vanishing with zero trace — matches every sibling
  // translate*PersistError in this codebase (bank-account-service.ts,
  // ledger-group-service.ts, ledger-service.ts, company-service.ts).
  throw new AppError(toActionErrorMessage(error));
}

export const roleService = {
  async listRoles(): Promise<RoleWithPermissionCount[]> {
    const user = await getCurrentCompanyUser();
    await assertPermission(user, "roles", "view");
    return roleRepository.findMany(user.companyId);
  },

  async getRole(id: string): Promise<Role | null> {
    const user = await getCurrentCompanyUser();
    await assertPermission(user, "roles", "view");
    return roleRepository.findById(id, user.companyId);
  },

  async createRole(input: RoleFormInput): Promise<Role> {
    const user = await getCurrentCompanyUser();
    await assertPermission(user, "roles", "create");
    const data = roleSchema.parse(input);

    // Custom roles a Company Admin creates are always scoped to their own
    // company and never system-defined/protected — only
    // TenantBootstrapService creates isSystemDefined/isProtected roles.
    try {
      return await roleRepository.create(user.companyId, data.name);
    } catch (error) {
      translateRolePersistError(error);
    }
  },

  async updateRole(id: string, input: RoleFormInput): Promise<Role> {
    const user = await getCurrentCompanyUser();
    await assertPermission(user, "roles", "edit");
    const data = roleSchema.parse(input);

    const existing = await roleRepository.findById(id, user.companyId);
    if (!existing) {
      throw new AppError("Role not found.");
    }

    // Renaming a protected (reserved) role would silently break every
    // authorization decision keyed off its name in TenantBootstrapService's
    // seed data — not renamed via role-service.ts. Deactivating, editing
    // its permissions (subject to the mandatory-set check in
    // permission-service.ts), or creating new custom roles under any other
    // name is unaffected.
    if (existing.isProtected && data.name !== existing.name) {
      throw new AppError(`"${existing.name}" is a reserved role and cannot be renamed.`);
    }

    let role: Role | null;
    try {
      role = await roleRepository.update(id, user.companyId, data.name);
    } catch (error) {
      translateRolePersistError(error);
    }

    if (!role) {
      throw new AppError("Role not found.");
    }
    return role;
  },

  async activateRole(id: string): Promise<Role> {
    const user = await getCurrentCompanyUser();
    await assertPermission(user, "roles", "edit");
    const role = await roleRepository.setActive(id, user.companyId, true);
    if (!role) {
      throw new AppError("Role not found.");
    }
    return role;
  },

  async deactivateRole(id: string): Promise<Role> {
    const user = await getCurrentCompanyUser();
    await assertPermission(user, "roles", "delete");
    const result = await roleRepository.deactivate(id, user.companyId);

    switch (result.status) {
      case "not_found":
        throw new AppError("Role not found.");
      case "protected":
        throw new AppError("This is a reserved role and cannot be deactivated.");
      case "last_full_coverage_role":
        throw new AppError("At least one active role with full access must remain.");
      case "ok":
        return result.role;
    }
  },

  /**
   * Seeds the 6 reserved default roles for a brand-new company and their
   * RolePermission rows, inside the caller's transaction (called by
   * TenantBootstrapService as one step of company creation — never invoked
   * standalone, so it takes no permission gate of its own, mirroring
   * ledgerGroupService.seedDefaultGroups()'s identical convention). Company
   * Admin is granted every permission in the live catalog, computed live
   * (never a fixed list) so it can never fall behind as modules/actions are
   * added — the other 5 reserved roles get their starting set from
   * DEFAULT_ROLE_PERMISSIONS. All 6 are isSystemDefined + isProtected.
   * Returns the new Company Admin role's id so the caller can assign it to
   * the Company Admin User being created in the same transaction.
   */
  async seedDefaultRoles(companyId: string, tx: Prisma.TransactionClient): Promise<{ companyAdminRoleId: string }> {
    const catalog = await tx.permission.findMany();
    const catalogIndex = new Map(catalog.map((permission) => [`${permission.module}:${permission.action}`, permission.id]));

    const companyAdminRole = await tx.role.create({
      data: { companyId, name: COMPANY_ADMIN_ROLE_NAME, isSystemDefined: true, isProtected: true },
    });
    if (catalog.length > 0) {
      await tx.rolePermission.createMany({
        data: catalog.map((permission) => ({ roleId: companyAdminRole.id, permissionId: permission.id })),
      });
    }

    for (const [roleName, pairs] of Object.entries(DEFAULT_ROLE_PERMISSIONS)) {
      const role = await tx.role.create({
        data: { companyId, name: roleName, isSystemDefined: true, isProtected: true },
      });

      const permissionIds = pairs
        .map((pair) => catalogIndex.get(`${pair.module}:${pair.action}`))
        .filter((id): id is string => Boolean(id));

      if (permissionIds.length > 0) {
        await tx.rolePermission.createMany({
          data: permissionIds.map((permissionId) => ({ roleId: role.id, permissionId })),
        });
      }
    }

    return { companyAdminRoleId: companyAdminRole.id };
  },
};
