"use server";

import { revalidatePath } from "next/cache";

import { toActionErrorMessage } from "@/lib/action-error";
import { permissionService } from "@/modules/roles/services/permission-service";
import type { ActionResult } from "@/types/api";
import type { PermissionPair } from "@/types/role";

export async function setRolePermissionsAction(
  roleId: string,
  pairs: PermissionPair[]
): Promise<ActionResult<undefined>> {
  try {
    await permissionService.setRolePermissions(roleId, pairs);
  } catch (error) {
    return { success: false, error: toActionErrorMessage(error) };
  }

  revalidatePath(`/settings/roles/${roleId}/edit`);
  revalidatePath("/settings/roles");
  return { success: true };
}
