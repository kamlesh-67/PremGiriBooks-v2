import type { UserFormInput } from "@/modules/users/validation/user-schema";
import type { UserWithRole } from "@/types/user";

export function toUserFormValues(user: UserWithRole): Partial<UserFormInput> {
  return {
    username: user.username,
    fullName: user.fullName,
    email: user.email,
    mobile: user.mobile ?? undefined,
    // passwordHash is never exposed to the UI — a blank password field means
    // "leave the current password unchanged" (enforced by updateUserSchema).
    password: "",
    roleId: user.role.id,
  };
}
