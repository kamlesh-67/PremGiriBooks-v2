import { cache } from "react";
import { cookies } from "next/headers";

import { AppError } from "@/lib/app-error";
import { COOKIE_KEYS } from "@/constants/cookie-keys";
import { getCurrentUserOrNull, resolveFailingClosed } from "@/lib/current-user";
import { companyService } from "@/modules/company/services/company-service";
import type { CompanyWithSettings } from "@/types/company";

const ACTIVE_COMPANY_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 30;

export async function getCurrentCompanyId(): Promise<string | null> {
  const cookieStore = await cookies();
  return cookieStore.get(COOKIE_KEYS.ACTIVE_COMPANY_ID)?.value ?? null;
}

export const getCurrentCompany = cache(async (): Promise<CompanyWithSettings | null> => {
  // A PLATFORM user (Super Admin) never has tenant context — not merely
  // "none selected," but never resolved at all, per this migration's
  // Permanent Architecture Principle 5. Checked before any cookie read or
  // DB query so this holds even if proxy.ts's route redirect is ever
  // bypassed or this is called from a shared layout that renders for both
  // user types (RootLayout does).
  const currentUser = await getCurrentUserOrNull();
  if (currentUser?.userType === "PLATFORM") {
    return null;
  }

  const companyId = await getCurrentCompanyId();
  if (!companyId) {
    return null;
  }

  // Fails closed: a stale active_company_id cookie can outlive its session
  // (e.g. the session expired or the user was disabled since it was set).
  // RootLayout calls this for every page, including the public /login page,
  // so it must never throw AuthenticationError — return null instead.
  const company = await resolveFailingClosed(() => companyService.getCompany(companyId));

  if (!company || !company.isActive) {
    return null;
  }

  return company;
});

export async function setCurrentCompany(companyId: string): Promise<CompanyWithSettings> {
  const company = await companyService.getCompany(companyId);
  if (!company) {
    throw new AppError("Company not found.");
  }

  if (!company.isActive) {
    throw new AppError("Inactive companies cannot be selected.");
  }

  const cookieStore = await cookies();
  cookieStore.set(COOKIE_KEYS.ACTIVE_COMPANY_ID, company.id, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: ACTIVE_COMPANY_COOKIE_MAX_AGE_SECONDS,
  });

  return company;
}

export async function clearCurrentCompany(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(COOKIE_KEYS.ACTIVE_COMPANY_ID);
}
