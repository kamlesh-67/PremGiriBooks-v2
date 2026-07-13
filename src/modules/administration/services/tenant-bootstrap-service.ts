import type { Prisma } from "@prisma/client";

import { AppError } from "@/lib/app-error";
import { roleService } from "@/modules/roles/services/role-service";
import { ledgerGroupService } from "@/modules/ledger-groups/services/ledger-group-service";
import { ledgerService } from "@/modules/ledgers/services/ledger-service";
import { normalizeFinancialYearInput } from "@/modules/financial-year/utils/normalize-financial-year-input";
import {
  financialYearSchema,
  type FinancialYearInput,
} from "@/modules/financial-year/validation/financial-year-schema";

export interface BootstrapTenantResult {
  companyAdminRoleId: string;
}

/**
 * Single owner of company initialization (Permanent Architecture Principle
 * 4) — every step a brand-new company needs runs from here, inside the
 * caller's transaction, so a failure at any step rolls the whole company
 * back with it. Callers: companyService.createCompany() (the real,
 * assertSuperAdmin()-gated HTTP path) and prisma/seed.ts (the bootstrap
 * script, which has no request/session context to gate against — same
 * reasoning this codebase has always used for seed.ts bypassing service-
 * level auth checks).
 *
 * Order matters: Financial Year has no dependency on the seeded roles, but
 * is created here (not left to a later step) so a bad date range fails the
 * whole company creation atomically rather than leaving a company with
 * roles/permissions but no financial year.
 */
export const tenantBootstrapService = {
  async bootstrapTenant(
    companyId: string,
    input: { financialYear: FinancialYearInput },
    tx: Prisma.TransactionClient
  ): Promise<BootstrapTenantResult> {
    const financialYearData = normalizeFinancialYearInput(financialYearSchema.parse(input.financialYear));

    const overlapping = await tx.financialYear.findMany({
      where: {
        companyId,
        startDate: { lte: financialYearData.endDate },
        endDate: { gte: financialYearData.startDate },
      },
    });
    if (overlapping.length > 0) {
      throw new AppError("This date range overlaps an existing financial year for this company.");
    }
    await tx.financialYear.create({ data: { ...financialYearData, companyId } });

    const { companyAdminRoleId } = await roleService.seedDefaultRoles(companyId, tx);

    await ledgerGroupService.seedDefaultGroups(companyId, tx);
    await ledgerService.seedDefaultLedger(companyId, tx);

    return { companyAdminRoleId };
  },
};
