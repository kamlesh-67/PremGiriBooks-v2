import type { Permission } from "@prisma/client";

import { AppError } from "@/lib/app-error";
import { assertAdministrator } from "@/lib/current-user";
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

export const permissionService = {
  async listCatalog(): Promise<Permission[]> {
    await assertAdministrator();
    return permissionRepository.findCatalog();
  },

  async getRolePermissionIds(roleId: string): Promise<string[]> {
    await assertAdministrator();
    return permissionRepository.findRolePermissionIds(roleId);
  },

  async setRolePermissions(roleId: string, pairs: PermissionPair[]): Promise<void> {
    await assertAdministrator();
    const validatedPairs = assignPermissionsSchema.parse(pairs);

    const catalog = await permissionRepository.findCatalog();
    const catalogIndex = indexCatalogByPair(catalog);

    const permissionIds: string[] = [];
    for (const pair of validatedPairs) {
      const id = catalogIndex.get(`${pair.module}:${pair.action}`);
      if (!id) {
        throw new AppError(`Unknown permission: ${pair.module}/${pair.action}.`);
      }
      permissionIds.push(id);
    }

    const result = await permissionRepository.assignToRole(roleId, permissionIds);
    switch (result.status) {
      case "not_found":
        throw new AppError("Role not found.");
      case "last_administrator_capable":
        throw new AppError("At least one active role with full access must remain.");
      case "ok":
        return;
    }
  },

  /**
   * Bootstrap-only, called from prisma/seed.ts — deliberately not gated by
   * assertAdministrator() since it runs outside any authenticated request
   * (mirrors seed.ts's existing unauthenticated direct-Prisma role upserts).
   * Administrator always gets every catalog permission, computed live from
   * the catalog rather than a fixed list, so it can never fall behind as
   * modules/actions are added. The other five default roles get the
   * additive, editable starting subset from constants/permissions.ts.
   */
  async seedDefaults(): Promise<void> {
    await permissionRepository.ensureCatalog(buildCatalogPairs());
    const catalog = await permissionRepository.findCatalog();
    const catalogIndex = indexCatalogByPair(catalog);

    const administratorRole = await roleRepository.findByName("Administrator");
    if (administratorRole) {
      await permissionRepository.seedRolePermissions(
        administratorRole.id,
        catalog.map((permission) => permission.id)
      );
    }

    for (const [roleName, pairs] of Object.entries(DEFAULT_ROLE_PERMISSIONS)) {
      const role = await roleRepository.findByName(roleName);
      if (!role) {
        continue;
      }

      const permissionIds = pairs
        .map((pair) => catalogIndex.get(`${pair.module}:${pair.action}`))
        .filter((id): id is string => Boolean(id));

      await permissionRepository.seedRolePermissions(role.id, permissionIds);
    }
  },
};
