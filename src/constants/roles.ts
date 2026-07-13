// The six reserved default roles TenantBootstrapService seeds for every new
// company, per architecture-Migration-Super-Admin-Administration.md. Unlike
// the pre-migration model, authorization no longer compares a role's NAME
// against a literal string anywhere in business logic (Permanent
// Architecture Principle 1/2) — protection for these roles (cannot rename,
// delete, deactivate, or lose their mandatory permission set) is enforced
// structurally via Role.isProtected, not via this list. This constant now
// exists only as the seed list and to derive DEFAULT_ROLE_PERMISSIONS' key
// type below.
export const DEFAULT_ROLE_NAMES = [
  "Company Admin",
  "Accountant",
  "Sales",
  "Purchase",
  "Store Manager",
  "Employee",
] as const;

// The one hardcoded role name this codebase still relies on — used only to
// seed the per-company Company Admin role and to identify it when granting
// full catalog coverage (TenantBootstrapService). Never used for
// authorization (that's userType === "PLATFORM" for Super Admin, and
// assertPermission() for every Company-side check).
export const COMPANY_ADMIN_ROLE_NAME = "Company Admin";
