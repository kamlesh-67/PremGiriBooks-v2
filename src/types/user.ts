import type { User, Role } from "@prisma/client";

export type SafeUser = Omit<User, "passwordHash">;

// companyId/role are narrowed to non-null here — every UserWithRole this
// app produces comes from modules/users/repositories/user-repository.ts,
// which only ever handles COMPANY-type users (always company- and
// role-assigned by construction). The raw Prisma User/Role relation is
// nullable only to support PLATFORM users, which this repository never
// touches — see assertHasRole()'s doc comment there.
export type UserWithRole = Omit<SafeUser, "companyId"> & { companyId: string; role: Role };

export interface UserListFilters {
  search?: string;
}

export type DeactivateUserResult =
  | { status: "ok"; user: UserWithRole }
  | { status: "not_found" }
  | { status: "self" }
  | { status: "last_active_admin" };

export type SetActiveByIdResult =
  | { status: "ok"; user: UserWithRole }
  | { status: "not_found" }
  | { status: "last_active_admin" };

export type ReassignCompanyResult =
  | { status: "ok"; user: UserWithRole; previousCompanyId: string }
  | { status: "not_found" }
  | { status: "same_company" }
  | { status: "target_company_not_found" }
  | { status: "target_role_not_found" }
  | { status: "last_active_admin" };

export type UpdateUserResult =
  | { status: "ok"; user: UserWithRole }
  | { status: "not_found" }
  | { status: "invalid_role" }
  | { status: "inactive_role" }
  | { status: "last_active_admin" };

export type CreateUserResult =
  | { status: "ok"; user: UserWithRole }
  | { status: "invalid_role" }
  | { status: "inactive_role" };

// Cross-company summary row for the Administration module's Company Admins
// list (/administration/company-admins) — the one place a Super Admin
// reads Users across every company at once, unlike every other userRepository
// method which is scoped to a single companyId.
export interface CompanyAdminSummary {
  id: string;
  username: string;
  fullName: string;
  email: string;
  mobile: string | null;
  isActive: boolean;
  companyId: string;
  companyName: string;
}
