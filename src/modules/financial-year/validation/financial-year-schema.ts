import { z } from "zod";

const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

function isValidCalendarDate(value: string): boolean {
  if (!DATE_REGEX.test(value)) {
    return false;
  }

  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) {
    return false;
  }

  // Date silently rolls over out-of-range days/months (e.g. 2026-02-30 becomes
  // 2026-03-02) instead of rejecting them — round-trip to reject those.
  return date.toISOString().slice(0, 10) === value;
}

export const financialYearSchema = z
  .object({
    name: z.string().trim().min(1, "Name is required"),
    startDate: z
      .string()
      .trim()
      .refine(isValidCalendarDate, { message: "Enter a valid start date" }),
    endDate: z
      .string()
      .trim()
      .refine(isValidCalendarDate, { message: "Enter a valid end date" }),
  })
  .refine(
    (data) =>
      !isValidCalendarDate(data.startDate) ||
      !isValidCalendarDate(data.endDate) ||
      new Date(`${data.startDate}T00:00:00.000Z`) < new Date(`${data.endDate}T00:00:00.000Z`),
    { message: "Start date must be before end date", path: ["endDate"] }
  );

export type FinancialYearInput = z.infer<typeof financialYearSchema>;
