"use server";

import { revalidatePath } from "next/cache";

import { toActionErrorMessage } from "@/lib/action-error";
import { userService } from "@/modules/users/services/user-service";
import type { UserFormInput } from "@/modules/users/validation/user-schema";
import type { ActionResult } from "@/types/api";
import type { UserWithRole } from "@/types/user";

export async function createUserAction(
  input: UserFormInput
): Promise<ActionResult<UserWithRole>> {
  let user: UserWithRole;
  try {
    user = await userService.createUser(input);
  } catch (error) {
    return { success: false, error: toActionErrorMessage(error) };
  }

  revalidatePath("/settings/users");
  return { success: true, data: user };
}

export async function updateUserAction(
  id: string,
  input: UserFormInput
): Promise<ActionResult<UserWithRole>> {
  let user: UserWithRole;
  try {
    user = await userService.updateUser(id, input);
  } catch (error) {
    return { success: false, error: toActionErrorMessage(error) };
  }

  revalidatePath("/settings/users");
  revalidatePath(`/settings/users/${id}/edit`);
  return { success: true, data: user };
}

export async function activateUserAction(id: string): Promise<ActionResult<UserWithRole>> {
  let user: UserWithRole;
  try {
    user = await userService.activateUser(id);
  } catch (error) {
    return { success: false, error: toActionErrorMessage(error) };
  }

  revalidatePath("/settings/users");
  return { success: true, data: user };
}

export async function deactivateUserAction(id: string): Promise<ActionResult<UserWithRole>> {
  let user: UserWithRole;
  try {
    user = await userService.deactivateUser(id);
  } catch (error) {
    return { success: false, error: toActionErrorMessage(error) };
  }

  revalidatePath("/settings/users");
  return { success: true, data: user };
}
