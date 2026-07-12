"use server";

import { revalidatePath } from "next/cache";
import { ZodError } from "zod";

import { AuthorizationError } from "@/lib/current-user";
import { permissionService } from "@/modules/roles/services/permission-service";
import type { ActionResult } from "@/types/api";
import type { PermissionPair } from "@/types/role";

function toErrorMessage(error: unknown): string {
  if (error instanceof AuthorizationError) {
    return error.message;
  }

  if (error instanceof ZodError) {
    return error.issues[0]?.message ?? "Invalid permission selection.";
  }

  if (error instanceof Error) {
    return error.message;
  }

  return "Something went wrong. Please try again.";
}

export async function setRolePermissionsAction(
  roleId: string,
  pairs: PermissionPair[]
): Promise<ActionResult<undefined>> {
  try {
    await permissionService.setRolePermissions(roleId, pairs);
  } catch (error) {
    return { success: false, error: toErrorMessage(error) };
  }

  revalidatePath(`/settings/roles/${roleId}/edit`);
  revalidatePath("/settings/roles");
  return { success: true };
}
