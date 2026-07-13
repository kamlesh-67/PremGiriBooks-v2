"use server";

import { revalidatePath } from "next/cache";

import { toActionErrorMessage } from "@/lib/action-error";
import { companyService } from "@/modules/company/services/company-service";
import type { CreateCompanyInput } from "@/modules/administration/validation/create-company-schema";
import type { CompanyInput } from "@/modules/company/validation/company-schema";
import type { ActionResult } from "@/types/api";
import type { CompanyWithSettings } from "@/types/company";

// Relocated from modules/company/actions/company-actions.ts — per the
// Company Module split, creating/editing legal info/activating/
// deactivating a Company are Super-Admin-only Platform operations now, not
// something a Company Admin can reach. Company Admin's own actions
// (updateCompanySettingsAction, uploadCompanyLogoAction,
// selectCompanyAction) stay in company-actions.ts.

export async function createCompanyAction(
  input: CreateCompanyInput
): Promise<ActionResult<CompanyWithSettings>> {
  try {
    const company = await companyService.createCompany(input);
    revalidatePath("/administration/companies");
    return { success: true, data: company };
  } catch (error) {
    return { success: false, error: toActionErrorMessage(error) };
  }
}

export async function updateCompanyAction(
  id: string,
  input: CompanyInput
): Promise<ActionResult<CompanyWithSettings>> {
  try {
    const company = await companyService.updateCompany(id, input);
    revalidatePath("/administration/companies");
    revalidatePath(`/administration/companies/${id}/edit`);
    return { success: true, data: company };
  } catch (error) {
    return { success: false, error: toActionErrorMessage(error) };
  }
}

export async function activateCompanyAction(id: string): Promise<ActionResult<CompanyWithSettings>> {
  try {
    const company = await companyService.activateCompany(id);
    revalidatePath("/administration/companies");
    return { success: true, data: company };
  } catch (error) {
    return { success: false, error: toActionErrorMessage(error) };
  }
}

export async function deactivateCompanyAction(
  id: string
): Promise<ActionResult<CompanyWithSettings>> {
  try {
    const company = await companyService.deactivateCompany(id);
    revalidatePath("/administration/companies");
    return { success: true, data: company };
  } catch (error) {
    return { success: false, error: toActionErrorMessage(error) };
  }
}
