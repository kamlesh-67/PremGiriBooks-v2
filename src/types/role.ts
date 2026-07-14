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

// "protected" and "missing_mandatory_permissions" are deliberately absent —
// permissionRepository.assignToRole() only ever returns the statuses below.
// Both those checks (Company Admin's permission set is immutable; a
// protected role can't drop its mandatory pairs) already run earlier, in
// permission-service.ts's setRolePermissions(), before the repository is
// ever called — they'd be unreachable dead code here, not a real
// defense-in-depth duplicate.
export type AssignPermissionsResult =
  | { status: "ok" }
  | { status: "not_found" }
  | { status: "last_full_coverage_role" };
