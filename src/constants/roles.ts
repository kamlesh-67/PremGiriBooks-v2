// The six default roles seeded by prisma/seed.ts, per 07-authentication.md.
// Almost every existing admin gate in this codebase (assertAdministrator(),
// isCurrentUserAdmin(), and every module's own admin check) compares a
// user's role NAME against the literal string "Administrator" rather than
// an id or a flag — so renaming any of these seeded roles through
// role-service.ts would silently break authorization everywhere that
// depends on the name, with no in-app recovery path. role-service.ts uses
// this list to block renaming (but not deactivating, editing permissions
// on, or creating new custom roles named anything else).
export const DEFAULT_ROLE_NAMES = [
  "Administrator",
  "Accountant",
  "Sales",
  "Purchase",
  "Store Manager",
  "Employee",
] as const;
