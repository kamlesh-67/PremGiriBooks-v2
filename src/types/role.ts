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
  | { status: "last_administrator_capable" };

export type AssignPermissionsResult =
  | { status: "ok" }
  | { status: "not_found" }
  | { status: "last_administrator_capable" };
