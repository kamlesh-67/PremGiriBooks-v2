import type { User, Role } from "@prisma/client";

export type SafeUser = Omit<User, "passwordHash">;

export type UserWithRole = SafeUser & { role: Role };

export interface UserListFilters {
  search?: string;
}

export type DeactivateUserResult =
  | { status: "ok"; user: UserWithRole }
  | { status: "not_found" }
  | { status: "self" }
  | { status: "last_administrator" };

export type UpdateUserResult =
  | { status: "ok"; user: UserWithRole }
  | { status: "not_found" }
  | { status: "invalid_role" }
  | { status: "inactive_role" }
  | { status: "last_administrator" };

export type CreateUserResult =
  | { status: "ok"; user: UserWithRole }
  | { status: "invalid_role" }
  | { status: "inactive_role" };
