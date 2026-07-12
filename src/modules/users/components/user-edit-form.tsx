"use client";

import type { Role } from "@prisma/client";

import { updateUserAction } from "@/modules/users/actions/user-actions";
import { UserForm } from "@/modules/users/components/user-form";
import type { UserFormInput } from "@/modules/users/validation/user-schema";

interface UserEditFormProps {
  userId: string;
  roles: Role[];
  defaultValues: Partial<UserFormInput>;
}

export function UserEditForm({ userId, roles, defaultValues }: UserEditFormProps) {
  return (
    <UserForm
      mode="edit"
      roles={roles}
      defaultValues={defaultValues}
      submitLabel="Save Changes"
      onSubmit={(data: UserFormInput) => updateUserAction(userId, data)}
    />
  );
}
