import type { FinancialYear } from "@prisma/client";

import type { FinancialYearInput } from "@/modules/financial-year/validation/financial-year-schema";

function toDateInputValue(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function toFinancialYearFormValues(financialYear: FinancialYear): FinancialYearInput {
  return {
    name: financialYear.name,
    startDate: toDateInputValue(financialYear.startDate),
    endDate: toDateInputValue(financialYear.endDate),
  };
}
