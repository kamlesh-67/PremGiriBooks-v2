"use client";

import type { Role } from "@prisma/client";

import { createUserAction } from "@/modules/users/actions/user-actions";
import { UserForm } from "@/modules/users/components/user-form";
import type { UserFormInput } from "@/modules/users/validation/user-schema";

interface UserCreateFormProps {
  roles: Role[];
}

export function UserCreateForm({ roles }: UserCreateFormProps) {
  return (
    <UserForm
      mode="create"
      roles={roles}
      submitLabel="Create User"
      onSubmit={(data: UserFormInput) => createUserAction(data)}
    />
  );
}
