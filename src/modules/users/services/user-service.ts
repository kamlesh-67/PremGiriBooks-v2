import type { Role } from "@prisma/client";

import { AuthorizationError, type CurrentUser, getCurrentUser } from "@/lib/current-user";
import { logger } from "@/lib/logger";
import { hashPassword } from "@/lib/password";
import { roleRepository } from "@/modules/users/repositories/role-repository";
import { userRepository } from "@/modules/users/repositories/user-repository";
import { getUniqueConstraintFields } from "@/modules/users/utils/prisma-errors";
import { normalizeUserProfileInput } from "@/modules/users/utils/normalize-user-input";
import {
  createUserSchema,
  updateUserSchema,
  type UserFormInput,
} from "@/modules/users/validation/user-schema";
import type {
  CreateUserResult,
  UpdateUserResult,
  UserListFilters,
  UserWithRole,
} from "@/types/user";

async function requireAdministrator(): Promise<CurrentUser> {
  const currentUser = await getCurrentUser();
  if (currentUser.role !== "Administrator") {
    throw new AuthorizationError();
  }
  return currentUser;
}

function translateUserPersistError(error: unknown): never {
  const fields = getUniqueConstraintFields(error);
  if (fields.includes("username")) {
    throw new Error("Username is already taken.");
  }
  if (fields.includes("email")) {
    throw new Error("Email is already registered.");
  }

  // Anything else is unexpected (e.g. a transient DB error) — never surface
  // raw internal detail to the client, per code-standards.md's "Never expose
  // internal exceptions to users."
  logger.error({ err: error }, "Unexpected error while saving a user");
  throw new Error("Failed to save the user. Please try again.");
}

export const userService = {
  async listUsers(filters: UserListFilters = {}): Promise<UserWithRole[]> {
    const currentUser = await requireAdministrator();
    return userRepository.findMany(currentUser.companyId, filters);
  },

  // A user belonging to a different company must resolve identically to "not
  // found" — never distinguish "exists but isn't yours" from "doesn't
  // exist," which would let an Administrator of one company enumerate user
  // ids belonging to another.
  async getUser(id: string): Promise<UserWithRole | null> {
    const currentUser = await requireAdministrator();
    const user = await userRepository.findById(id);
    if (!user || user.companyId !== currentUser.companyId) {
      return null;
    }
    return user;
  },

  async listRoles(): Promise<Role[]> {
    await requireAdministrator();
    return roleRepository.findMany();
  },

  // companyId is deliberately never accepted as a parameter here — it is
  // always the requesting Administrator's own company, derived server-side,
  // so a tampered client-supplied id can't plant a user (or a new
  // Administrator) inside a company the caller has no relationship to.
  async createUser(input: UserFormInput): Promise<UserWithRole> {
    const currentUser = await requireAdministrator();
    const data = createUserSchema.parse(input);

    const profile = normalizeUserProfileInput(data);
    const passwordHash = await hashPassword(data.password);

    // The role's existence and active status are checked inside
    // userRepository.create()'s own transaction, not here beforehand — a
    // separate pre-write read here would leave a TOCTOU window where the
    // role could be deactivated by another request between the check and
    // the write. See that method's comment for the full reasoning.
    let result: CreateUserResult;
    try {
      result = await userRepository.create(currentUser.companyId, profile, passwordHash);
    } catch (error) {
      translateUserPersistError(error);
    }

    switch (result.status) {
      case "invalid_role":
        throw new Error("Selected role does not exist.");
      case "inactive_role":
        throw new Error("Selected role is inactive and cannot be assigned.");
      case "ok":
        return result.user;
    }
  },

  async updateUser(id: string, input: UserFormInput): Promise<UserWithRole> {
    const currentUser = await requireAdministrator();
    const data = updateUserSchema.parse(input);

    const profile = normalizeUserProfileInput(data);
    const passwordHash = data.password ? await hashPassword(data.password) : undefined;

    // Same reasoning as createUser above — the role check (only performed
    // when the role is actually changing) lives inside
    // userRepository.updateProfile()'s own transaction.
    let result: UpdateUserResult;
    try {
      result = await userRepository.updateProfile(id, currentUser.companyId, profile, passwordHash);
    } catch (error) {
      translateUserPersistError(error);
    }

    switch (result.status) {
      case "not_found":
        throw new Error("User not found.");
      case "invalid_role":
        throw new Error("Selected role does not exist.");
      case "inactive_role":
        throw new Error("Selected role is inactive and cannot be assigned.");
      case "last_administrator":
        throw new Error("At least one active Administrator must remain for this company.");
      case "ok":
        return result.user;
    }
  },

  async activateUser(id: string): Promise<UserWithRole> {
    const currentUser = await requireAdministrator();
    const user = await userRepository.setActive(id, currentUser.companyId, true);
    if (!user) {
      throw new Error("User not found.");
    }
    return user;
  },

  async deactivateUser(id: string): Promise<UserWithRole> {
    const currentUser = await requireAdministrator();

    const result = await userRepository.deactivate(id, currentUser.companyId, currentUser.id);
    switch (result.status) {
      case "not_found":
        throw new Error("User not found.");
      case "self":
        throw new Error("You cannot deactivate your own account.");
      case "last_administrator":
        throw new Error("At least one active Administrator must remain for this company.");
      case "ok":
        return result.user;
    }
  },
};
