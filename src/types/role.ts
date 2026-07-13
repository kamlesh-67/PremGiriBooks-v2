import type { Permission, Role } from "@prisma/client";

export type { Permission };

export interface RoleWithPermissionCount extends Role {
  _count: { permissions: number };
}

export interface PermissionPair {
  module: string;
  action: string;
}

export type DeactivateRoleResult =
  | { status: "ok"; role: Role }
  | { status: "not_found" }
  | { status: "protected" }
  | { status: "last_full_coverage_role" };

export type AssignPermissionsResult =
  | { status: "ok" }
  | { status: "not_found" }
  | { status: "protected" }
  | { status: "missing_mandatory_permissions"; missing: PermissionPair[] }
  | { status: "last_full_coverage_role" };
