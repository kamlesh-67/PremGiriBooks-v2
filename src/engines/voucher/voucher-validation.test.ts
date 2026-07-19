import { describe, expect, it } from "vitest";

import {
  hasAtMostTwoDecimals,
  isBalanced,
  isValidCalendarDate,
  postVoucherInputSchema,
  toPaise,
  toUtcDate,
} from "@/engines/voucher/voucher-validation";

const LEDGER_A = "11111111-1111-4111-8111-111111111111";
const LEDGER_B = "22222222-2222-4222-8222-222222222222";
const FY_ID = "33333333-3333-4333-8333-333333333333";

function baseInput(overrides: Record<string, unknown> = {}) {
  return {
    financialYearId: FY_ID,
    voucherType: "PAYMENT",
    voucherDate: "2026-04-15",
    entries: [
      { ledgerId: LEDGER_A, entryType: "DEBIT", amount: 100 },
      { ledgerId: LEDGER_B, entryType: "CREDIT", amount: 100 },
    ],
    ...overrides,
  };
}

describe("isValidCalendarDate", () => {
  it("accepts a valid calendar date", () => {
    expect(isValidCalendarDate("2026-04-15")).toBe(true);
  });

  it("rejects a malformed date string", () => {
    expect(isValidCalendarDate("15-04-2026")).toBe(false);
  });

  it("rejects a date that Date would silently roll over", () => {
    expect(isValidCalendarDate("2026-02-30")).toBe(false);
  });
});

describe("toUtcDate", () => {
  it("parses a calendar date to UTC midnight", () => {
    const date = toUtcDate("2026-04-15");
    expect(date.toISOString()).toBe("2026-04-15T00:00:00.000Z");
  });
});

describe("toPaise", () => {
  it("converts a 2-decimal amount to an integer paise value", () => {
    expect(toPaise(100.5)).toBe(10050);
  });

  it("rounds away float drift", () => {
    expect(toPaise(0.1 + 0.2)).toBe(30);
  });
});

describe("hasAtMostTwoDecimals", () => {
  it("accepts a whole number", () => {
    expect(hasAtMostTwoDecimals(100)).toBe(true);
  });

  it("accepts exactly 2 decimal places", () => {
    expect(hasAtMostTwoDecimals(100.25)).toBe(true);
  });

  it("rejects 3 decimal places", () => {
    expect(hasAtMostTwoDecimals(100.255)).toBe(false);
  });
});

describe("isBalanced — the balance matrix", () => {
  it("accepts a simple 2-entry balanced voucher", () => {
    expect(
      isBalanced([
        { entryType: "DEBIT", amount: 100 },
        { entryType: "CREDIT", amount: 100 },
      ])
    ).toBe(true);
  });

  it("accepts a multi-line balanced voucher (split debit, single credit)", () => {
    expect(
      isBalanced([
        { entryType: "DEBIT", amount: 60 },
        { entryType: "DEBIT", amount: 40 },
        { entryType: "CREDIT", amount: 100 },
      ])
    ).toBe(true);
  });

  it("rejects a voucher off by a single paisa", () => {
    expect(
      isBalanced([
        { entryType: "DEBIT", amount: 100.01 },
        { entryType: "CREDIT", amount: 100 },
      ])
    ).toBe(false);
  });

  it("is not fooled by float drift that a naive sum would misreport", () => {
    // 0.1 + 0.2 !== 0.3 in raw floating point; the paise conversion must
    // still recognize this as balanced.
    expect(
      isBalanced([
        { entryType: "DEBIT", amount: 0.1 },
        { entryType: "DEBIT", amount: 0.2 },
        { entryType: "CREDIT", amount: 0.3 },
      ])
    ).toBe(true);
  });

  it("rejects a single-entry list (never balanced, no offsetting side)", () => {
    expect(isBalanced([{ entryType: "DEBIT", amount: 100 }])).toBe(false);
  });

  it("treats an empty entry list as balanced (0 === 0) — the schema's min(2) rejects this shape separately", () => {
    expect(isBalanced([])).toBe(true);
  });
});

describe("postVoucherInputSchema", () => {
  it("accepts a valid, balanced voucher", () => {
    expect(() => postVoucherInputSchema.parse(baseInput())).not.toThrow();
  });

  it("rejects fewer than 2 entries", () => {
    expect(() =>
      postVoucherInputSchema.parse(baseInput({ entries: [{ ledgerId: LEDGER_A, entryType: "DEBIT", amount: 100 }] }))
    ).toThrow();
  });

  it("rejects an unbalanced voucher", () => {
    expect(() =>
      postVoucherInputSchema.parse(
        baseInput({
          entries: [
            { ledgerId: LEDGER_A, entryType: "DEBIT", amount: 100 },
            { ledgerId: LEDGER_B, entryType: "CREDIT", amount: 90 },
          ],
        })
      )
    ).toThrow("Total debit must equal total credit");
  });

  it("rejects a zero amount", () => {
    expect(() =>
      postVoucherInputSchema.parse(
        baseInput({
          entries: [
            { ledgerId: LEDGER_A, entryType: "DEBIT", amount: 0 },
            { ledgerId: LEDGER_B, entryType: "CREDIT", amount: 0 },
          ],
        })
      )
    ).toThrow();
  });

  it("rejects a negative amount", () => {
    expect(() =>
      postVoucherInputSchema.parse(
        baseInput({
          entries: [
            { ledgerId: LEDGER_A, entryType: "DEBIT", amount: -100 },
            { ledgerId: LEDGER_B, entryType: "CREDIT", amount: -100 },
          ],
        })
      )
    ).toThrow();
  });

  it("rejects an amount with 3 decimal places", () => {
    expect(() =>
      postVoucherInputSchema.parse(
        baseInput({
          entries: [
            { ledgerId: LEDGER_A, entryType: "DEBIT", amount: 100.005 },
            { ledgerId: LEDGER_B, entryType: "CREDIT", amount: 100.005 },
          ],
        })
      )
    ).toThrow();
  });

  it("rejects an invalid voucher date", () => {
    expect(() => postVoucherInputSchema.parse(baseInput({ voucherDate: "2026-02-30" }))).toThrow();
  });

  it("rejects an invalid ledger id", () => {
    expect(() =>
      postVoucherInputSchema.parse(
        baseInput({ entries: [{ ledgerId: "not-a-uuid", entryType: "DEBIT", amount: 100 }, { ledgerId: LEDGER_B, entryType: "CREDIT", amount: 100 }] })
      )
    ).toThrow();
  });

  const REFERENCE_ID = "55555555-5555-4555-8555-555555555555";

  it("accepts both referenceType and referenceId omitted", () => {
    expect(() => postVoucherInputSchema.parse(baseInput())).not.toThrow();
  });

  it("accepts referenceType and referenceId provided together", () => {
    expect(() =>
      postVoucherInputSchema.parse(baseInput({ referenceType: "SALES_INVOICE", referenceId: REFERENCE_ID }))
    ).not.toThrow();
  });

  it("rejects referenceType without referenceId", () => {
    expect(() => postVoucherInputSchema.parse(baseInput({ referenceType: "SALES_INVOICE" }))).toThrow();
  });

  it("rejects referenceId without referenceType", () => {
    expect(() => postVoucherInputSchema.parse(baseInput({ referenceId: REFERENCE_ID }))).toThrow();
  });
});
