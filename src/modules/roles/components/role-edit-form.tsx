"use client";

import { updateRoleAction } from "@/modules/roles/actions/role-actions";
import { RoleForm } from "@/modules/roles/components/role-form";
import type { RoleFormInput } from "@/modules/roles/validation/role-schema";

interface RoleEditFormProps {
  roleId: string;
  defaultValues: Partial<RoleFormInput>;
}

export function RoleEditForm({ roleId, defaultValues }: RoleEditFormProps) {
  return (
    <RoleForm
      mode="edit"
      defaultValues={defaultValues}
      submitLabel="Save Changes"
      onSubmit={(data: RoleFormInput) => updateRoleAction(roleId, data)}
    />
  );
}
