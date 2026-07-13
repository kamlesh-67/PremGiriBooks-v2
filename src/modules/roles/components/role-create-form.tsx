"use client";

import { createRoleAction } from "@/modules/roles/actions/role-actions";
import { RoleForm } from "@/modules/roles/components/role-form";
import type { RoleFormInput } from "@/modules/roles/validation/role-schema";

export function RoleCreateForm() {
  return (
    <RoleForm
      mode="create"
      submitLabel="Create Role"
      onSubmit={(data: RoleFormInput) => createRoleAction(data)}
    />
  );
}
