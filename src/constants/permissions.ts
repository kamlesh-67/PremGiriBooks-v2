import { COMPANY_ADMIN_ROLE_NAME, DEFAULT_ROLE_NAMES } from "@/constants/roles";

// Modules match the sidebar sections in ui-context.md (Dashboard, Masters,
// Sales, Purchase, Inventory, Accounting, GST, Reports, Employees, Settings)
// plus the finer-grained modules already built (company, financial-year,
// users, roles), per 11-role-permissions.md's Data Model section. "roles"
// was added by the Super Admin migration so Role & Permission Management
// gates on assertPermission(user, "roles", ...) instead of a hardcoded
// role-name check (Permanent Architecture Principle 1/2).
export const PERMISSION_MODULES = [
  "dashboard",
  "masters",
  "sales",
  "purchase",
  "inventory",
  "accounting",
  "gst",
  "reports",
  "employees",
  "settings",
  "company",
  "financial-year",
  "users",
  "roles",
] as const;

export type PermissionModule = (typeof PERMISSION_MODULES)[number];

export const PERMISSION_ACTIONS = ["view", "create", "edit", "delete", "approve", "export"] as const;

export type PermissionAction = (typeof PERMISSION_ACTIONS)[number];

interface PermissionPairSeed {
  module: PermissionModule;
  action: PermissionAction;
}

// Every non-Company-Admin reserved role name must have an entry below — a
// Record keyed by this type (rather than a bare `string`) fails to compile
// if a key is misspelled or a role is added/removed from DEFAULT_ROLE_NAMES
// without updating this map. These are also each reserved role's *mandatory*
// permission set (role-service.ts rejects removing any pair listed here for
// an isProtected role — only adding extra permissions on top is allowed).
type NonCompanyAdminDefaultRoleName = Exclude<
  (typeof DEFAULT_ROLE_NAMES)[number],
  typeof COMPANY_ADMIN_ROLE_NAME
>;

/**
 * Forward-declarative seed values for the five non-Company-Admin reserved
 * roles from 07-authentication.md, per 11-role-permissions.md: "the modules
 * themselves don't exist yet, so there is nothing to verify these against
 * beyond the seed data being sensible and editable." Company Admin is
 * handled separately in TenantBootstrapService (always every module/action)
 * rather than listed here, so it can never drift from the live catalog.
 */
export const DEFAULT_ROLE_PERMISSIONS: Record<NonCompanyAdminDefaultRoleName, PermissionPairSeed[]> = {
  Accountant: [
    { module: "dashboard", action: "view" },
    { module: "financial-year", action: "view" },
    { module: "accounting", action: "view" },
    { module: "accounting", action: "create" },
    { module: "accounting", action: "edit" },
    { module: "accounting", action: "export" },
    { module: "gst", action: "view" },
    { module: "gst", action: "create" },
    { module: "gst", action: "edit" },
    { module: "gst", action: "export" },
    { module: "reports", action: "view" },
    { module: "reports", action: "export" },
  ],
  Sales: [
    { module: "dashboard", action: "view" },
    { module: "masters", action: "view" },
    { module: "sales", action: "view" },
    { module: "sales", action: "create" },
    { module: "reports", action: "view" },
    { module: "reports", action: "create" },
  ],
  Purchase: [
    { module: "dashboard", action: "view" },
    { module: "masters", action: "view" },
    { module: "purchase", action: "view" },
    { module: "purchase", action: "create" },
    { module: "reports", action: "view" },
    { module: "reports", action: "create" },
  ],
  "Store Manager": [
    { module: "dashboard", action: "view" },
    { module: "masters", action: "view" },
    { module: "inventory", action: "view" },
    { module: "inventory", action: "create" },
    { module: "inventory", action: "edit" },
    { module: "reports", action: "view" },
  ],
  Employee: [{ module: "dashboard", action: "view" }],
};
