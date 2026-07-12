import type { UserFormInput } from "@/modules/users/validation/user-schema";

export interface UserProfileFields {
  username: string;
  fullName: string;
  email: string;
  mobile: string | null;
  roleId: string;
}

export function normalizeUserProfileInput(input: UserFormInput): UserProfileFields {
  return {
    username: input.username,
    fullName: input.fullName,
    email: input.email,
    mobile: input.mobile ? input.mobile : null,
    roleId: input.roleId,
  };
}
