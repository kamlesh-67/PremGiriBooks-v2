import type { FinancialYear } from "@prisma/client";

export type { FinancialYear };

export interface CloseFinancialYearResult {
  financialYear: FinancialYear;
  wasCurrent: boolean;
  promotedFinancialYearId: string | null;
}
