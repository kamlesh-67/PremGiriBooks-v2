"use server";

import type { Role } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { ZodError } from "zod";

import { AuthorizationError } from "@/lib/current-user";
import { roleService } from "@/modules/roles/services/role-service";
import type { RoleFormInput } from "@/modules/roles/validation/role-schema";
import type { ActionResult } from "@/types/api";

function toErrorMessage(error: unknown): string {
  if (error instanceof AuthorizationError) {
    return error.message;
  }

  if (error instanceof ZodError) {
    return error.issues[0]?.message ?? "Invalid input.";
  }

  if (error instanceof Error) {
    return error.message;
  }

  return "Something went wrong. Please try again.";
}

export async function createRoleAction(input: RoleFormInput): Promise<ActionResult<Role>> {
  let role: Role;
  try {
    role = await roleService.createRole(input);
  } catch (error) {
    return { success: false, error: toErrorMessage(error) };
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
    return { success: false, error: toErrorMessage(error) };
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
    return { success: false, error: toErrorMessage(error) };
  }

  revalidatePath("/settings/roles");
  return { success: true, data: role };
}

export async function deactivateRoleAction(id: string): Promise<ActionResult<Role>> {
  let role: Role;
  try {
    role = await roleService.deactivateRole(id);
  } catch (error) {
    return { success: false, error: toErrorMessage(error) };
  }

  revalidatePath("/settings/roles");
  return { success: true, data: role };
}
