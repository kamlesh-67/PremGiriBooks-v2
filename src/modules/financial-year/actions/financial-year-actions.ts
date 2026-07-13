"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { toActionErrorMessage } from "@/lib/action-error";
import { getCurrentCompany } from "@/lib/current-company";
import {
  clearCurrentFinancialYear,
  getCurrentFinancialYearId,
  setCurrentFinancialYear,
} from "@/lib/current-financial-year";
import { financialYearService } from "@/modules/financial-year/services/financial-year-service";
import type { FinancialYearInput } from "@/modules/financial-year/validation/financial-year-schema";
import type { ActionResult } from "@/types/api";
import type { FinancialYear } from "@/types/financial-year";

export async function createFinancialYearAction(
  input: FinancialYearInput
): Promise<ActionResult<FinancialYear>> {
  try {
    const company = await getCurrentCompany();
    if (!company) {
      return { success: false, error: "Select a company before creating a financial year." };
    }

    const financialYear = await financialYearService.createFinancialYear(company.id, input);
    revalidatePath("/financial-year");
    return { success: true, data: financialYear };
  } catch (error) {
    return { success: false, error: toActionErrorMessage(error) };
  }
}

export async function updateFinancialYearAction(
  id: string,
  input: FinancialYearInput
): Promise<ActionResult<FinancialYear>> {
  try {
    const financialYear = await financialYearService.updateFinancialYear(id, input);
    revalidatePath("/financial-year");
    revalidatePath(`/financial-year/${id}/edit`);
    return { success: true, data: financialYear };
  } catch (error) {
    return { success: false, error: toActionErrorMessage(error) };
  }
}

export async function setCurrentFinancialYearAction(
  id: string
): Promise<ActionResult<FinancialYear>> {
  try {
    const financialYear = await financialYearService.setCurrent(id);
    revalidatePath("/financial-year");
    return { success: true, data: financialYear };
  } catch (error) {
    return { success: false, error: toActionErrorMessage(error) };
  }
}

export async function closeFinancialYearAction(id: string): Promise<ActionResult<FinancialYear>> {
  try {
    const result = await financialYearService.closeFinancialYear(id);

    if (result.wasCurrent && (await getCurrentFinancialYearId()) === id) {
      if (result.promotedFinancialYearId) {
        await setCurrentFinancialYear(result.promotedFinancialYearId);
      } else {
        await clearCurrentFinancialYear();
      }
    }

    revalidatePath("/financial-year");
    return { success: true, data: result.financialYear };
  } catch (error) {
    return { success: false, error: toActionErrorMessage(error) };
  }
}

export async function selectFinancialYearAction(financialYearId: string): Promise<ActionResult> {
  try {
    await setCurrentFinancialYear(financialYearId);
  } catch (error) {
    return { success: false, error: toActionErrorMessage(error) };
  }

  revalidatePath("/", "layout");
  redirect("/");
}
