import type { Permission } from "@prisma/client";

import { AppError } from "@/lib/app-error";
import { getCurrentCompanyUser } from "@/lib/current-user";
import { assertPermission } from "@/lib/permissions";
import { COMPANY_ADMIN_ROLE_NAME } from "@/constants/roles";
import { DEFAULT_ROLE_PERMISSIONS, PERMISSION_ACTIONS, PERMISSION_MODULES } from "@/constants/permissions";
import { permissionRepository } from "@/modules/roles/repositories/permission-repository";
import { roleRepository } from "@/modules/roles/repositories/role-repository";
import { assignPermissionsSchema } from "@/modules/roles/validation/role-schema";
import type { PermissionPair } from "@/types/role";

function buildCatalogPairs(): PermissionPair[] {
  const pairs: PermissionPair[] = [];
  for (const moduleName of PERMISSION_MODULES) {
    for (const action of PERMISSION_ACTIONS) {
      pairs.push({ module: moduleName, action });
    }
  }
  return pairs;
}

function indexCatalogByPair(catalog: Permission[]): Map<string, string> {
  return new Map(catalog.map((permission) => [`${permission.module}:${permission.action}`, permission.id]));
}

/**
 * The mandatory (non-removable) permission pairs for a protected reserved
 * role, by name — Company Admin's mandatory set is "the entire live
 * catalog" (its permissions are never editable at all, checked by the
 * caller before this is consulted); the other 5 reserved roles' mandatory
 * sets come from DEFAULT_ROLE_PERMISSIONS. Returns an empty array for any
 * non-reserved (custom) role, which has no mandatory set.
 */
function mandatoryPairsForRole(roleName: string): PermissionPair[] {
  if (roleName === COMPANY_ADMIN_ROLE_NAME) {
    return buildCatalogPairs();
  }
  const pairs = (DEFAULT_ROLE_PERMISSIONS as Record<string, PermissionPair[] | undefined>)[roleName];
  return pairs ?? [];
}

export const permissionService = {
  async listCatalog(): Promise<Permission[]> {
    const user = await getCurrentCompanyUser();
    await assertPermission(user, "roles", "view");
    return permissionRepository.findCatalog();
  },

  async getRolePermissionIds(roleId: string): Promise<string[]> {
    const user = await getCurrentCompanyUser();
    await assertPermission(user, "roles", "view");

    const role = await roleRepository.findById(roleId, user.companyId);
    if (!role) {
      throw new AppError("Role not found.");
    }
    return permissionRepository.findRolePermissionIds(roleId);
  },

  async setRolePermissions(roleId: string, pairs: PermissionPair[]): Promise<void> {
    const user = await getCurrentCompanyUser();
    await assertPermission(user, "roles", "edit");
    const validatedPairs = assignPermissionsSchema.parse(pairs);

    const role = await roleRepository.findById(roleId, user.companyId);
    if (!role) {
      throw new AppError("Role not found.");
    }

    // Company Admin's permission set is never editable — it always has
    // every catalog permission, granted once by TenantBootstrapService, so
    // it can never drift from the live catalog and can never be
    // accidentally weakened.
    if (role.isProtected && role.name === COMPANY_ADMIN_ROLE_NAME) {
      throw new AppError("The Company Admin role's permissions cannot be modified.");
    }

    const catalog = await permissionRepository.findCatalog();
    const catalogIndex = indexCatalogByPair(catalog);

    const permissionIds: string[] = [];
    const submittedPairKeys = new Set<string>();
    for (const pair of validatedPairs) {
      const key = `${pair.module}:${pair.action}`;
      const id = catalogIndex.get(key);
      if (!id) {
        throw new AppError(`Unknown permission: ${pair.module}/${pair.action}.`);
      }
      permissionIds.push(id);
      submittedPairKeys.add(key);
    }

    // A protected role (one of the 5 non-Company-Admin reserved roles) can
    // gain permissions beyond its seeded set, but never lose one of them —
    // checked here, not in the repository layer, since it needs the
    // DEFAULT_ROLE_PERMISSIONS mapping this module owns.
    if (role.isProtected) {
      const mandatoryPairs = mandatoryPairsForRole(role.name);
      const missing = mandatoryPairs.filter(
        (pair) => !submittedPairKeys.has(`${pair.module}:${pair.action}`)
      );
      if (missing.length > 0) {
        throw new AppError(
          `Cannot remove required permissions from the reserved "${role.name}" role: ` +
            missing.map((pair) => `${pair.module}.${pair.action}`).join(", ")
        );
      }
    }

    const result = await permissionRepository.assignToRole(roleId, user.companyId, permissionIds);
    switch (result.status) {
      case "not_found":
        throw new AppError("Role not found.");
      case "last_full_coverage_role":
        throw new AppError("At least one active role with full access must remain.");
      case "ok":
        return;
    }
  },

  /**
   * The Permission catalog itself is global — a capability *definition*
   * list (module x action pairs), not tenant data — so it is still ensured
   * once, idempotently, not per company. Called from prisma/seed.ts.
   * Per-company Role/RolePermission seeding now lives in
   * roleService.seedDefaultRoles(), invoked by TenantBootstrapService at
   * company-creation time, not here.
   *
   * Also backfills catalog growth into every company's already-seeded
   * Company Admin role: seedDefaultRoles grants "every permission in the
   * catalog at the moment the company is created" — correct then, but
   * nothing re-grants an existing company's Company Admin role when the
   * catalog later gains modules/actions, silently defanging every
   * full-coverage guard (role-coverage.ts) for that company. Additive-only
   * (permissionRepository.seedRolePermissions skips duplicates), so this is
   * safe to run on every boot/seed regardless of how many companies exist.
   */
  async ensureCatalog(): Promise<void> {
    await permissionRepository.ensureCatalog(buildCatalogPairs());

    const catalog = await permissionRepository.findCatalog();
    if (catalog.length === 0) {
      return;
    }
    const catalogIds = catalog.map((permission) => permission.id);

    const companyAdminRoles = await roleRepository.findAllProtectedByName(COMPANY_ADMIN_ROLE_NAME);
    for (const role of companyAdminRoles) {
      await permissionRepository.seedRolePermissions(role.id, catalogIds);
    }
  },
};
