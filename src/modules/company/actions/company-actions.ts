"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { ZodError } from "zod";

import { assertAdministrator, AuthorizationError } from "@/lib/current-user";
import { setCurrentCompany } from "@/lib/current-company";
import { companyService } from "@/modules/company/services/company-service";
import { companySettingsService } from "@/modules/company/services/company-settings-service";
import { saveCompanyLogo } from "@/modules/company/services/company-logo-service";
import type { CompanyInput, CompanySettingsInput } from "@/modules/company/validation/company-schema";
import type { ActionResult } from "@/types/api";
import type { CompanySettings, CompanyWithSettings } from "@/types/company";

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

export async function createCompanyAction(
  input: CompanyInput
): Promise<ActionResult<CompanyWithSettings>> {
  try {
    const company = await companyService.createCompany(input);
    revalidatePath("/company");
    return { success: true, data: company };
  } catch (error) {
    return { success: false, error: toErrorMessage(error) };
  }
}

export async function updateCompanyAction(
  id: string,
  input: CompanyInput
): Promise<ActionResult<CompanyWithSettings>> {
  try {
    const company = await companyService.updateCompany(id, input);
    revalidatePath("/company");
    revalidatePath(`/company/${id}/edit`);
    return { success: true, data: company };
  } catch (error) {
    return { success: false, error: toErrorMessage(error) };
  }
}

export async function activateCompanyAction(id: string): Promise<ActionResult<CompanyWithSettings>> {
  try {
    const company = await companyService.activateCompany(id);
    revalidatePath("/company");
    return { success: true, data: company };
  } catch (error) {
    return { success: false, error: toErrorMessage(error) };
  }
}

export async function deactivateCompanyAction(
  id: string
): Promise<ActionResult<CompanyWithSettings>> {
  try {
    const company = await companyService.deactivateCompany(id);
    revalidatePath("/company");
    return { success: true, data: company };
  } catch (error) {
    return { success: false, error: toErrorMessage(error) };
  }
}

export async function updateCompanySettingsAction(
  companyId: string,
  input: CompanySettingsInput
): Promise<ActionResult<CompanySettings>> {
  try {
    const settings = await companySettingsService.updateSettings(companyId, input);
    revalidatePath(`/company/${companyId}/edit`);
    return { success: true, data: settings };
  } catch (error) {
    return { success: false, error: toErrorMessage(error) };
  }
}

export async function uploadCompanyLogoAction(
  formData: FormData
): Promise<ActionResult<{ path: string }>> {
  try {
    await assertAdministrator();

    const file = formData.get("logo");
    if (!(file instanceof File) || file.size === 0) {
      return { success: false, error: "Select a logo file to upload." };
    }

    const logoPath = await saveCompanyLogo(file);
    return { success: true, data: { path: logoPath } };
  } catch (error) {
    return { success: false, error: toErrorMessage(error) };
  }
}

export async function selectCompanyAction(companyId: string): Promise<ActionResult> {
  try {
    await setCurrentCompany(companyId);
  } catch (error) {
    return { success: false, error: toErrorMessage(error) };
  }

  revalidatePath("/", "layout");
  redirect("/");
}
