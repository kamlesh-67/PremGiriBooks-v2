import { cache } from "react";
import { cookies } from "next/headers";

import { COOKIE_KEYS } from "@/constants/cookie-keys";
import { getCurrentCompanyId } from "@/lib/current-company";
import { AuthenticationError } from "@/lib/current-user";
import { financialYearService } from "@/modules/financial-year/services/financial-year-service";
import type { FinancialYear } from "@/types/financial-year";

const ACTIVE_FINANCIAL_YEAR_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 30;

export async function getCurrentFinancialYearId(): Promise<string | null> {
  const cookieStore = await cookies();
  return cookieStore.get(COOKIE_KEYS.ACTIVE_FINANCIAL_YEAR_ID)?.value ?? null;
}

export const getCurrentFinancialYear = cache(async (): Promise<FinancialYear | null> => {
  const financialYearId = await getCurrentFinancialYearId();
  if (!financialYearId) {
    return null;
  }

  const companyId = await getCurrentCompanyId();
  if (!companyId) {
    return null;
  }

  // Fails closed — see the matching comment in current-company.ts. RootLayout
  // calls this for every page, including the public /login page, so a stale
  // active_financial_year_id cookie outliving its session must resolve to
  // null rather than throw AuthenticationError.
  let financialYear: FinancialYear | null;
  try {
    financialYear = await financialYearService.getFinancialYear(financialYearId);
  } catch (error) {
    if (error instanceof AuthenticationError) {
      return null;
    }
    throw error;
  }

  if (!financialYear || financialYear.companyId !== companyId || financialYear.isClosed) {
    return null;
  }

  return financialYear;
});

export async function setCurrentFinancialYear(financialYearId: string): Promise<FinancialYear> {
  const financialYear = await financialYearService.getFinancialYear(financialYearId);
  if (!financialYear) {
    throw new Error("Financial year not found.");
  }

  const companyId = await getCurrentCompanyId();
  if (!companyId || financialYear.companyId !== companyId) {
    throw new Error("This financial year does not belong to the active company.");
  }

  if (financialYear.isClosed) {
    throw new Error("Closed financial years cannot be selected.");
  }

  const cookieStore = await cookies();
  cookieStore.set(COOKIE_KEYS.ACTIVE_FINANCIAL_YEAR_ID, financialYear.id, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: ACTIVE_FINANCIAL_YEAR_COOKIE_MAX_AGE_SECONDS,
  });

  return financialYear;
}

export async function clearCurrentFinancialYear(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(COOKIE_KEYS.ACTIVE_FINANCIAL_YEAR_ID);
}
