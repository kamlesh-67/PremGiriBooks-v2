"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { toActionErrorMessage } from "@/lib/action-error";
import {
  PASSWORD_COMPLEXITY_MESSAGE,
  PASSWORD_COMPLEXITY_REGEX,
  PASSWORD_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
} from "@/constants/password-policy";
import { platformUserService } from "@/modules/administration/services/platform-user-service";
import type { SaveCompanyAdminInput } from "@/modules/administration/validation/create-company-schema";
import type { ActionResult } from "@/types/api";

const resetPasswordSchema = z
  .string()
  .min(PASSWORD_MIN_LENGTH, `Password must be at least ${PASSWORD_MIN_LENGTH} characters`)
  .max(PASSWORD_MAX_LENGTH, "Password is too long")
  .refine((value) => PASSWORD_COMPLEXITY_REGEX.test(value), { message: PASSWORD_COMPLEXITY_MESSAGE });

export async function resetCompanyAdminPasswordAction(
  userId: string,
  newPassword: string
): Promise<ActionResult<undefined>> {
  try {
    const parsed = resetPasswordSchema.parse(newPassword);
    await platformUserService.resetCompanyAdminPassword(userId, parsed);
  } catch (error) {
    return { success: false, error: toActionErrorMessage(error) };
  }

  return { success: true };
}

export async function saveCompanyAdminAction(
  userId: string,
  input: SaveCompanyAdminInput
): Promise<ActionResult<undefined>> {
  try {
    await platformUserService.saveCompanyAdmin(userId, input);
  } catch (error) {
    return { success: false, error: toActionErrorMessage(error) };
  }

  revalidatePath("/administration/company-admins");
  return { success: true };
}

export async function setCompanyAdminActiveAction(
  userId: string,
  isActive: boolean
): Promise<ActionResult<undefined>> {
  try {
    await platformUserService.setCompanyAdminActive(userId, isActive);
  } catch (error) {
    return { success: false, error: toActionErrorMessage(error) };
  }

  revalidatePath("/administration/company-admins");
  return { success: true };
}
