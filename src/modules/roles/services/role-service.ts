import type { Role } from "@prisma/client";

import { DEFAULT_ROLE_NAMES } from "@/constants/roles";
import { assertAdministrator } from "@/lib/current-user";
import { logger } from "@/lib/logger";
import { roleRepository } from "@/modules/roles/repositories/role-repository";
import { isUniqueConstraintError } from "@/modules/roles/utils/prisma-errors";
import { roleSchema, type RoleFormInput } from "@/modules/roles/validation/role-schema";
import type { RoleWithPermissionCount } from "@/types/role";

function translateRolePersistError(error: unknown): never {
  if (isUniqueConstraintError(error)) {
    throw new Error("A role with this name already exists.");
  }

  // Never surface raw internal detail to the client, per code-standards.md's
  // "Never expose internal exceptions to users."
  logger.error({ err: error }, "Unexpected error while saving a role");
  throw new Error("Failed to save the role. Please try again.");
}

export const roleService = {
  async listRoles(): Promise<RoleWithPermissionCount[]> {
    await assertAdministrator();
    return roleRepository.findMany();
  },

  async getRole(id: string): Promise<Role | null> {
    await assertAdministrator();
    return roleRepository.findById(id);
  },

  async createRole(input: RoleFormInput): Promise<Role> {
    await assertAdministrator();
    const data = roleSchema.parse(input);

    try {
      return await roleRepository.create(data.name);
    } catch (error) {
      translateRolePersistError(error);
    }
  },

  async updateRole(id: string, input: RoleFormInput): Promise<Role> {
    await assertAdministrator();
    const data = roleSchema.parse(input);

    const existing = await roleRepository.findById(id);
    if (!existing) {
      throw new Error("Role not found.");
    }

    // Almost every admin gate in this codebase (assertAdministrator(),
    // isCurrentUserAdmin(), and every other module's own check) compares a
    // role's NAME against a literal string, not an id or a flag. Renaming
    // one of the six seeded default roles — most critically "Administrator"
    // — would silently break authorization for every user holding it, with
    // no in-app recovery path (undoing the rename itself requires passing
    // the now-broken assertAdministrator() check). Only renaming is
    // blocked; deactivating a default role, editing its permissions, or
    // creating new custom roles under any other name is unaffected.
    const isDefaultRole = (DEFAULT_ROLE_NAMES as readonly string[]).includes(existing.name);
    if (isDefaultRole && data.name !== existing.name) {
      throw new Error(`"${existing.name}" is a built-in role and cannot be renamed.`);
    }

    let role: Role | null;
    try {
      role = await roleRepository.update(id, data.name);
    } catch (error) {
      translateRolePersistError(error);
    }

    if (!role) {
      throw new Error("Role not found.");
    }
    return role;
  },

  async activateRole(id: string): Promise<Role> {
    await assertAdministrator();
    const role = await roleRepository.setActive(id, true);
    if (!role) {
      throw new Error("Role not found.");
    }
    return role;
  },

  async deactivateRole(id: string): Promise<Role> {
    await assertAdministrator();
    const result = await roleRepository.deactivate(id);

    switch (result.status) {
      case "not_found":
        throw new Error("Role not found.");
      case "last_administrator_capable":
        throw new Error("At least one active role with full access must remain.");
      case "ok":
        return result.role;
    }
  },
};
