"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { toActionErrorMessage } from "@/lib/action-error";
import { getCurrentCompanyUser } from "@/lib/current-user";
import { assertPermission } from "@/lib/permissions";
import { setCurrentCompany } from "@/lib/current-company";
import { companySettingsService } from "@/modules/company/services/company-settings-service";
import { saveCompanyLogo } from "@/modules/company/services/company-logo-service";
import type { CompanySettingsInput } from "@/modules/company/validation/company-schema";
import type { ActionResult } from "@/types/api";
import type { CompanySettings } from "@/types/company";

// Create/edit-legal-info/activate/deactivate moved to
// modules/administration/actions/company-admin-actions.ts — those are
// Super-Admin-only Platform operations now, per the Company Module split.

export async function updateCompanySettingsAction(
  companyId: string,
  input: CompanySettingsInput
): Promise<ActionResult<CompanySettings>> {
  try {
    const settings = await companySettingsService.updateSettings(companyId, input);
    revalidatePath(`/company/${companyId}/edit`);
    return { success: true, data: settings };
  } catch (error) {
    return { success: false, error: toActionErrorMessage(error) };
  }
}

export async function uploadCompanyLogoAction(
  formData: FormData
): Promise<ActionResult<{ path: string }>> {
  try {
    // Logo is a Company operational setting (per the original spec's
    // Company Module split), not a legal/business-info field — gated the
    // same way companySettingsService.updateSettings is.
    const user = await getCurrentCompanyUser();
    await assertPermission(user, "company", "edit");

    const file = formData.get("logo");
    if (!(file instanceof File) || file.size === 0) {
      return { success: false, error: "Select a logo file to upload." };
    }

    const logoPath = await saveCompanyLogo(file);
    return { success: true, data: { path: logoPath } };
  } catch (error) {
    return { success: false, error: toActionErrorMessage(error) };
  }
}

export async function selectCompanyAction(companyId: string): Promise<ActionResult> {
  try {
    await setCurrentCompany(companyId);
  } catch (error) {
    return { success: false, error: toActionErrorMessage(error) };
  }

  revalidatePath("/", "layout");
  redirect("/");
}
