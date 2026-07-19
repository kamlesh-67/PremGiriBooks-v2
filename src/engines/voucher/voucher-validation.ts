import { z } from "zod";

// Pure validation core for the Voucher Engine — no I/O, no Prisma client, no
// session lookups (30-pricing-engine.md's Structure convention, reused by
// 31-voucher-engine.md: "engines may import from modules; modules never
// re-implement engine logic"). Everything here is fully unit-testable
// without mocking the database.

// Mirrors financial-year-schema.ts's calendar-date convention — a plain
// YYYY-MM-DD string, round-tripped to reject dates like 2026-02-30 that
// `Date` would otherwise silently roll over.
const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

export function isValidCalendarDate(value: string): boolean {
  if (!DATE_REGEX.test(value)) {
    return false;
  }
  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) {
    return false;
  }
  return date.toISOString().slice(0, 10) === value;
}

/** `YYYY-MM-DD` -> UTC-midnight `Date`, the storage shape for `voucherDate` (`@db.Date`). */
export function toUtcDate(value: string): Date {
  return new Date(`${value}T00:00:00.000Z`);
}

/**
 * Integer-paise conversion — every balance/amount comparison in this engine
 * compares in paise (integers) instead of raw floats, to avoid float drift
 * (31-voucher-engine.md's Business Rules).
 */
export function toPaise(amount: number): number {
  return Math.round(amount * 100);
}

/** True when `amount` has at most 2 decimal places (mirrors pricing-engine.ts's assertQuantityPrecision). */
export function hasAtMostTwoDecimals(amount: number): boolean {
  return Math.abs(amount * 100 - Math.round(amount * 100)) < 1e-6;
}

export interface BalanceCheckLine {
  entryType: "DEBIT" | "CREDIT";
  amount: number;
}

/**
 * sum(DEBIT amounts) === sum(CREDIT amounts), compared in paise. Used both
 * as the object-level Zod refine below and directly by voucher-engine.ts/
 * tests — the single source of truth for "is this voucher balanced."
 */
export function isBalanced(entries: readonly BalanceCheckLine[]): boolean {
  let debitPaise = 0;
  let creditPaise = 0;
  for (const entry of entries) {
    const paise = toPaise(entry.amount);
    if (entry.entryType === "DEBIT") {
      debitPaise += paise;
    } else {
      creditPaise += paise;
    }
  }
  return debitPaise === creditPaise;
}

const BALANCE_TYPE_VALUES = ["DEBIT", "CREDIT"] as const;

const VOUCHER_TYPE_VALUES = [
  "PAYMENT",
  "RECEIPT",
  "CONTRA",
  "JOURNAL",
  "SALES",
  "PURCHASE",
  "CREDIT_NOTE",
  "DEBIT_NOTE",
  "SALES_RETURN",
  "PURCHASE_RETURN",
] as const;

export const voucherEntryLineSchema = z.object({
  ledgerId: z.uuid("Select a valid ledger"),
  entryType: z.enum(BALANCE_TYPE_VALUES, "Select a valid entry type"),
  amount: z
    .number("Amount must be a number")
    .positive("Amount must be greater than zero")
    .refine(hasAtMostTwoDecimals, "Amount can have at most 2 decimal places"),
});

// Engines are system boundaries for their consumers even though they are not
// HTTP boundaries (30-pricing-engine.md's Validation convention) —
// `companyId` is passed as postVoucher's own explicit parameter (not part of
// this schema), the authorized caller's tenant scope; every loaded row is
// still re-verified against it inside voucher-engine.ts (defense in depth,
// the standing engine convention).
export const postVoucherInputSchema = z
  .object({
    financialYearId: z.uuid("A valid financial year is required"),
    voucherType: z.enum(VOUCHER_TYPE_VALUES, "Select a valid voucher type"),
    voucherDate: z.string().trim().refine(isValidCalendarDate, "Enter a valid voucher date"),
    narration: z.string().trim().max(500, "Narration must be at most 500 characters").optional(),
    referenceType: z.string().trim().max(50, "Reference type must be at most 50 characters").optional(),
    referenceId: z.uuid("Reference id must be a valid id").optional(),
    createdByUserId: z.uuid("Created-by user id must be a valid id").optional(),
    entries: z.array(voucherEntryLineSchema).min(2, "A voucher must have at least 2 entries"),
  })
  .refine((data) => isBalanced(data.entries), {
    message: "Total debit must equal total credit",
    path: ["entries"],
  })
  .refine((data) => Boolean(data.referenceType) === Boolean(data.referenceId), {
    message: "referenceType and referenceId must both be provided together, or both omitted",
    path: ["referenceId"],
  });

export type PostVoucherInput = z.infer<typeof postVoucherInputSchema>;
export type VoucherEntryLineInput = z.infer<typeof voucherEntryLineSchema>;
