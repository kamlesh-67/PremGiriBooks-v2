import type { FinancialYearInput } from "@/modules/financial-year/validation/financial-year-schema";

export interface FinancialYearPersistData {
  name: string;
  startDate: Date;
  endDate: Date;
}

function toCalendarDate(value: string): Date {
  return new Date(`${value}T00:00:00.000Z`);
}

export function normalizeFinancialYearInput(input: FinancialYearInput): FinancialYearPersistData {
  return {
    name: input.name,
    startDate: toCalendarDate(input.startDate),
    endDate: toCalendarDate(input.endDate),
  };
}
