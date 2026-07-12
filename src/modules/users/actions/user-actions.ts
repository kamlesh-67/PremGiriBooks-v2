"use server";

import { revalidatePath } from "next/cache";
import { ZodError } from "zod";

import { AuthorizationError } from "@/lib/current-user";
import { userService } from "@/modules/users/services/user-service";
import type { UserFormInput } from "@/modules/users/validation/user-schema";
import type { ActionResult } from "@/types/api";
import type { UserWithRole } from "@/types/user";

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

export async function createUserAction(
  input: UserFormInput
): Promise<ActionResult<UserWithRole>> {
  let user: UserWithRole;
  try {
    user = await userService.createUser(input);
  } catch (error) {
    return { success: false, error: toErrorMessage(error) };
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
    return { success: false, error: toErrorMessage(error) };
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
    return { success: false, error: toErrorMessage(error) };
  }

  revalidatePath("/settings/users");
  return { success: true, data: user };
}

export async function deactivateUserAction(id: string): Promise<ActionResult<UserWithRole>> {
  let user: UserWithRole;
  try {
    user = await userService.deactivateUser(id);
  } catch (error) {
    return { success: false, error: toErrorMessage(error) };
  }

  revalidatePath("/settings/users");
  return { success: true, data: user };
}
