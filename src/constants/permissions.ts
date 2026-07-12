// Modules match the sidebar sections in ui-context.md (Dashboard, Masters,
// Sales, Purchase, Inventory, Accounting, GST, Reports, Employees, Settings)
// plus the finer-grained modules already built (company, financial-year,
// users), per 11-role-permissions.md's Data Model section.
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
] as const;

export type PermissionModule = (typeof PERMISSION_MODULES)[number];

export const PERMISSION_ACTIONS = ["view", "create", "edit", "delete", "approve", "export"] as const;

export type PermissionAction = (typeof PERMISSION_ACTIONS)[number];

interface PermissionPairSeed {
  module: PermissionModule;
  action: PermissionAction;
}

/**
 * Forward-declarative seed values for the five non-Administrator default
 * roles from 07-authentication.md, per 11-role-permissions.md: "the modules
 * themselves don't exist yet, so there is nothing to verify these against
 * beyond the seed data being sensible and editable." Administrator is
 * handled separately in permission-service.ts (always every module/action)
 * rather than listed here, so it can never drift from the live catalog.
 */
export const DEFAULT_ROLE_PERMISSIONS: Record<string, PermissionPairSeed[]> = {
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
