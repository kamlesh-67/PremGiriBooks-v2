import { describe, expect, it } from "vitest";

import {
  calculateDocument,
  calculateLine,
  determineSupplyType,
  isHsnRequired,
} from "@/engines/gst/gst-calculation";

describe("determineSupplyType", () => {
  it("returns INTRA_STATE when the company and place-of-supply codes are equal", () => {
    expect(determineSupplyType("27", "27")).toBe("INTRA_STATE");
  });

  it("returns INTER_STATE when the codes differ", () => {
    expect(determineSupplyType("27", "29")).toBe("INTER_STATE");
  });

  it.each([
    ["00", "27"],
    ["27", "00"],
    ["39", "27"],
    ["27", "96"],
  ])("rejects an invalid company/place-of-supply code pair (%s, %s)", (companyCode, placeCode) => {
    expect(() => determineSupplyType(companyCode, placeCode)).toThrow();
  });
});

describe("calculateLine — exclusive", () => {
  it("computes a clean statutory-slab exclusive line with an even tax split (intra-state)", () => {
    const result = calculateLine({
      amount: 1000,
      isInclusive: false,
      ratePercent: 18,
      cessPercent: 0,
      supplyType: "INTRA_STATE",
    });
    expect(result).toEqual({
      taxableAmount: 1000,
      cgst: 90,
      sgst: 90,
      igst: 0,
      cess: 0,
      totalTax: 180,
      totalAmount: 1180,
      isReverseCharge: false,
    });
  });

  it.each([
    [0, 0, 1000],
    [0.25, 2.5, 1002.5],
    [3, 30, 1030],
    [5, 50, 1050],
    [12, 120, 1120],
    [18, 180, 1180],
    [28, 280, 1280],
  ])("statutory slab %s%% on 1000 exclusive yields totalTax %s and totalAmount %s", (ratePercent, totalTax, totalAmount) => {
    const result = calculateLine({
      amount: 1000,
      isInclusive: false,
      ratePercent,
      cessPercent: 0,
      supplyType: "INTRA_STATE",
    });
    expect(result.taxableAmount).toBe(1000);
    expect(result.totalTax).toBe(totalTax);
    expect(result.totalAmount).toBe(totalAmount);
  });

  it("pins the odd-paisa intra-state split rule: the odd paisa lands on CGST, and cgst + sgst === totalTax exactly", () => {
    // 105 * 1% = 1.05 exactly -> 105 paise (odd) -> sgst floor(52), cgst 53.
    const result = calculateLine({
      amount: 105,
      isInclusive: false,
      ratePercent: 1,
      cessPercent: 0,
      supplyType: "INTRA_STATE",
    });
    expect(result.totalTax).toBe(1.05);
    expect(result.sgst).toBe(0.52);
    expect(result.cgst).toBe(0.53);
    // Compare in paise (not raw float addition) — the codebase's own
    // convention (voucher-validation.ts's isBalanced) for exact money
    // comparisons, since IEEE754 cannot represent most 2-decimal sums
    // exactly as independent floats.
    expect(Math.round(result.cgst * 100) + Math.round(result.sgst * 100)).toBe(Math.round(result.totalTax * 100));
  });

  it("routes the full rounded tax to IGST for inter-state, with the same odd-paisa total", () => {
    const result = calculateLine({
      amount: 105,
      isInclusive: false,
      ratePercent: 1,
      cessPercent: 0,
      supplyType: "INTER_STATE",
    });
    expect(result).toEqual({
      taxableAmount: 105,
      cgst: 0,
      sgst: 0,
      igst: 1.05,
      cess: 0,
      totalTax: 1.05,
      totalAmount: 106.05,
      isReverseCharge: false,
    });
  });

  it("flows a zero (exempt/nil) rate through with all-zero tax components", () => {
    const result = calculateLine({
      amount: 500,
      isInclusive: false,
      ratePercent: 0,
      cessPercent: 0,
      supplyType: "INTRA_STATE",
    });
    expect(result).toEqual({
      taxableAmount: 500,
      cgst: 0,
      sgst: 0,
      igst: 0,
      cess: 0,
      totalTax: 0,
      totalAmount: 500,
      isReverseCharge: false,
    });
  });

  it("echoes isReverseCharge through unchanged — the arithmetic is identical, only the flag passes through", () => {
    const result = calculateLine({
      amount: 1000,
      isInclusive: false,
      ratePercent: 18,
      cessPercent: 0,
      supplyType: "INTRA_STATE",
      isReverseCharge: true,
    });
    expect(result.isReverseCharge).toBe(true);
    expect(result.totalTax).toBe(180);
  });

  it("defaults isReverseCharge to false when omitted", () => {
    const result = calculateLine({
      amount: 1000,
      isInclusive: false,
      ratePercent: 18,
      cessPercent: 0,
      supplyType: "INTRA_STATE",
    });
    expect(result.isReverseCharge).toBe(false);
  });
});

describe("calculateLine — inclusive", () => {
  it("back-calculates a clean inclusive amount (118 @ 18% -> taxable 100)", () => {
    const result = calculateLine({
      amount: 118,
      isInclusive: true,
      ratePercent: 18,
      cessPercent: 0,
      supplyType: "INTRA_STATE",
    });
    expect(result).toEqual({
      taxableAmount: 100,
      cgst: 9,
      sgst: 9,
      igst: 0,
      cess: 0,
      totalTax: 18,
      totalAmount: 118,
      isReverseCharge: false,
    });
  });

  it("pins the inclusive residual rule with cess: components sum exactly to the supplied amount and totalAmount equals it", () => {
    // amount=100, rate=18%, cess=12% -> backCalculatedTaxable = 100/1.30 = 76.923... ,
    // totalTax rounds to 13.85, cess rounds to 9.23, taxable absorbs the residual: 76.92.
    const result = calculateLine({
      amount: 100,
      isInclusive: true,
      ratePercent: 18,
      cessPercent: 12,
      supplyType: "INTRA_STATE",
    });
    expect(result.taxableAmount).toBe(76.92);
    expect(result.totalTax).toBe(13.85);
    expect(result.cess).toBe(9.23);
    expect(result.cgst).toBe(6.93);
    expect(result.sgst).toBe(6.92);
    expect(result.totalAmount).toBe(100);

    const componentSumPaise =
      Math.round(result.taxableAmount * 100) + Math.round(result.totalTax * 100) + Math.round(result.cess * 100);
    expect(componentSumPaise).toBe(Math.round(100 * 100));
  });

  it("applies the same inclusive-with-cess back-calculation for inter-state (IGST instead of CGST/SGST)", () => {
    const result = calculateLine({
      amount: 100,
      isInclusive: true,
      ratePercent: 18,
      cessPercent: 12,
      supplyType: "INTER_STATE",
    });
    expect(result).toEqual({
      taxableAmount: 76.92,
      cgst: 0,
      sgst: 0,
      igst: 13.85,
      cess: 9.23,
      totalTax: 13.85,
      totalAmount: 100,
      isReverseCharge: false,
    });
  });

  it("flows a zero-rate inclusive line through unchanged (taxable === amount)", () => {
    const result = calculateLine({
      amount: 500,
      isInclusive: true,
      ratePercent: 0,
      cessPercent: 0,
      supplyType: "INTER_STATE",
    });
    expect(result).toEqual({
      taxableAmount: 500,
      cgst: 0,
      sgst: 0,
      igst: 0,
      cess: 0,
      totalTax: 0,
      totalAmount: 500,
      isReverseCharge: false,
    });
  });
});

describe("calculateLine — validation boundary", () => {
  it("rejects a 3-decimal amount", () => {
    expect(() =>
      calculateLine({ amount: 100.001, isInclusive: false, ratePercent: 18, cessPercent: 0, supplyType: "INTRA_STATE" })
    ).toThrow();
  });

  it("rejects a 3-decimal ratePercent", () => {
    expect(() =>
      calculateLine({ amount: 100, isInclusive: false, ratePercent: 18.155, cessPercent: 0, supplyType: "INTRA_STATE" })
    ).toThrow();
  });

  it("rejects a 3-decimal cessPercent", () => {
    expect(() =>
      calculateLine({ amount: 100, isInclusive: false, ratePercent: 18, cessPercent: 1.005, supplyType: "INTRA_STATE" })
    ).toThrow();
  });

  it("rejects zero or negative amount", () => {
    expect(() =>
      calculateLine({ amount: 0, isInclusive: false, ratePercent: 18, cessPercent: 0, supplyType: "INTRA_STATE" })
    ).toThrow();
    expect(() =>
      calculateLine({ amount: -10, isInclusive: false, ratePercent: 18, cessPercent: 0, supplyType: "INTRA_STATE" })
    ).toThrow();
  });

  it("rejects a rate or cess percent outside 0-100", () => {
    expect(() =>
      calculateLine({ amount: 100, isInclusive: false, ratePercent: 101, cessPercent: 0, supplyType: "INTRA_STATE" })
    ).toThrow();
    expect(() =>
      calculateLine({ amount: 100, isInclusive: false, ratePercent: 18, cessPercent: -1, supplyType: "INTRA_STATE" })
    ).toThrow();
  });

  it("rejects an invalid supplyType", () => {
    expect(() =>
      calculateLine({
        amount: 100,
        isInclusive: false,
        ratePercent: 18,
        cessPercent: 0,
        // @ts-expect-error — deliberately invalid enum value for the boundary test
        supplyType: "SOMEWHERE_ELSE",
      })
    ).toThrow();
  });

  it("rejects a non-finite amount", () => {
    expect(() =>
      calculateLine({
        amount: Number.POSITIVE_INFINITY,
        isInclusive: false,
        ratePercent: 18,
        cessPercent: 0,
        supplyType: "INTRA_STATE",
      })
    ).toThrow();
  });
});

describe("calculateDocument", () => {
  function mixedRateLines(supplyType: "INTRA_STATE" | "INTER_STATE") {
    return [
      { amount: 1000, isInclusive: false, ratePercent: 18, cessPercent: 0, supplyType },
      { amount: 500, isInclusive: false, ratePercent: 18, cessPercent: 0, supplyType },
      { amount: 2000, isInclusive: false, ratePercent: 28, cessPercent: 12, supplyType },
      { amount: 300, isInclusive: false, ratePercent: 28, cessPercent: 0, supplyType },
      { amount: 118, isInclusive: true, ratePercent: 18, cessPercent: 0, supplyType },
    ] as const;
  }

  it("aggregates a multi-line, mixed-rate document into per-(rate, cess) groups (intra-state)", () => {
    const result = calculateDocument(mixedRateLines("INTRA_STATE"));

    expect(result.groups).toHaveLength(3);
    expect(result.groups.find((g) => g.ratePercent === 18 && g.cessPercent === 0)).toEqual({
      ratePercent: 18,
      cessPercent: 0,
      taxableAmount: 1600,
      cgst: 144,
      sgst: 144,
      igst: 0,
      cess: 0,
      totalTax: 288,
    });
    expect(result.groups.find((g) => g.ratePercent === 28 && g.cessPercent === 12)).toEqual({
      ratePercent: 28,
      cessPercent: 12,
      taxableAmount: 2000,
      cgst: 280,
      sgst: 280,
      igst: 0,
      cess: 240,
      totalTax: 560,
    });
    expect(result.groups.find((g) => g.ratePercent === 28 && g.cessPercent === 0)).toEqual({
      ratePercent: 28,
      cessPercent: 0,
      taxableAmount: 300,
      cgst: 42,
      sgst: 42,
      igst: 0,
      cess: 0,
      totalTax: 84,
    });

    expect(result.taxableAmount).toBe(3900);
    expect(result.cgst).toBe(466);
    expect(result.sgst).toBe(466);
    expect(result.igst).toBe(0);
    expect(result.cess).toBe(240);
    expect(result.totalTax).toBe(932);
    expect(result.totalAmount).toBe(5072);
  });

  it("aggregates the same document into IGST instead of CGST/SGST (inter-state)", () => {
    const result = calculateDocument(mixedRateLines("INTER_STATE"));

    expect(result.cgst).toBe(0);
    expect(result.sgst).toBe(0);
    expect(result.igst).toBe(932);
    expect(result.cess).toBe(240);
    expect(result.totalTax).toBe(932);
    expect(result.totalAmount).toBe(5072);
  });

  it("keeps two lines at the same rate but different cess in separate groups", () => {
    const result = calculateDocument([
      { amount: 1000, isInclusive: false, ratePercent: 28, cessPercent: 12, supplyType: "INTRA_STATE" },
      { amount: 1000, isInclusive: false, ratePercent: 28, cessPercent: 0, supplyType: "INTRA_STATE" },
    ]);
    expect(result.groups).toHaveLength(2);
    expect(result.groups.map((g) => g.cessPercent).sort()).toEqual([0, 12]);
  });

  it("rejects an empty lines array", () => {
    expect(() => calculateDocument([])).toThrow();
  });
});

describe("isHsnRequired", () => {
  it("is required and missing for a taxed line with no code", () => {
    expect(isHsnRequired(true, undefined)).toBe(true);
    expect(isHsnRequired(true, null)).toBe(true);
    expect(isHsnRequired(true, "")).toBe(true);
    expect(isHsnRequired(true, "   ")).toBe(true);
  });

  it("is satisfied for a taxed line that has a code", () => {
    expect(isHsnRequired(true, "4901")).toBe(false);
  });

  it("is never required for a non-taxed line, regardless of code presence", () => {
    expect(isHsnRequired(false, undefined)).toBe(false);
    expect(isHsnRequired(false, "4901")).toBe(false);
  });
});
