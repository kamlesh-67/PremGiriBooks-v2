"use server";

import type { Role } from "@prisma/client";
import { revalidatePath } from "next/cache";

import { toActionErrorMessage } from "@/lib/action-error";
import { roleService } from "@/modules/roles/services/role-service";
import type { RoleFormInput } from "@/modules/roles/validation/role-schema";
import type { ActionResult } from "@/types/api";

export async function createRoleAction(input: RoleFormInput): Promise<ActionResult<Role>> {
  let role: Role;
  try {
    role = await roleService.createRole(input);
  } catch (error) {
    return { success: false, error: toActionErrorMessage(error) };
  }

  revalidatePath("/settings/roles");
  return { success: true, data: role };
}

export async function updateRoleAction(
  id: string,
  input: RoleFormInput
): Promise<ActionResult<Role>> {
  let role: Role;
  try {
    role = await roleService.updateRole(id, input);
  } catch (error) {
    return { success: false, error: toActionErrorMessage(error) };
  }

  revalidatePath("/settings/roles");
  revalidatePath(`/settings/roles/${id}/edit`);
  return { success: true, data: role };
}

export async function activateRoleAction(id: string): Promise<ActionResult<Role>> {
  let role: Role;
  try {
    role = await roleService.activateRole(id);
  } catch (error) {
    return { success: false, error: toActionErrorMessage(error) };
  }

  revalidatePath("/settings/roles");
  revalidatePath(`/settings/roles/${id}/edit`);
  return { success: true, data: role };
}

export async function deactivateRoleAction(id: string): Promise<ActionResult<Role>> {
  let role: Role;
  try {
    role = await roleService.deactivateRole(id);
  } catch (error) {
    return { success: false, error: toActionErrorMessage(error) };
  }

  revalidatePath("/settings/roles");
  revalidatePath(`/settings/roles/${id}/edit`);
  return { success: true, data: role };
}
