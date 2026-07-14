import type { Branch, UserType } from "@prisma/client";

import { getCurrentCompany } from "@/lib/current-company";
import { type CurrentUser, getCurrentUser } from "@/lib/current-user";
import { getCurrentFinancialYear } from "@/lib/current-financial-year";
import type { CompanyWithSettings } from "@/types/company";
import type { FinancialYear } from "@/types/financial-year";

/**
 * Tenant (Company/Financial Year/Branch) context for a COMPANY user — always
 * null for a PLATFORM user, per this migration's Permanent Architecture
 * Principle 5. Branch is always null today since Branch Selection
 * (feature-spec 12) isn't implemented yet — the field exists so this shape
 * doesn't need to change when it is.
 */
export interface TenantContext {
  company: CompanyWithSettings;
  financialYear: FinancialYear | null;
  branch: Branch | null;
}

export interface SystemContext {
  user: CurrentUser;
  userType: UserType;
  tenant: TenantContext | null;
}

/**
 * Composes the existing per-request cache()-wrapped primitives
 * (getCurrentUser/getCurrentCompany/getCurrentFinancialYear) into one
 * object. This is the standard new code should resolve context through
 * going forward (TenantBootstrapService, the Administration module, and
 * any service written after this migration) — existing pre-migration
 * services still call getCurrentUser()/getCurrentCompanyUser() directly and
 * are deliberately NOT being retrofitted onto this in the same change (see
 * architecture-Migration-Super-Admin-Administration-Implementation-Plan.md's
 * Phase 2 scope note): those primitives are already per-request deduped, so
 * there's no real duplicate-work cost to leaving them as-is, and rewriting
 * ~15 existing service files' call sites would double this migration's
 * blast radius for no behavioral change.
 */
export async function resolveSystemContext(): Promise<SystemContext> {
  const user = await getCurrentUser();

  if (user.userType === "PLATFORM") {
    return { user, userType: "PLATFORM", tenant: null };
  }

  const company = await getCurrentCompany();
  if (!company) {
    return { user, userType: "COMPANY", tenant: null };
  }

  const financialYear = await getCurrentFinancialYear();

  return {
    user,
    userType: "COMPANY",
    tenant: { company, financialYear, branch: null },
  };
}
