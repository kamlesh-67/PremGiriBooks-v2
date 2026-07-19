import { describe, expect, it } from "vitest";

import { createMarginProfileSchema } from "@/modules/margin-profiles/validation/margin-profile-schema";

const VALID_INPUT = {
  name: "Retail Standard",
  calculationMode: "MARGIN",
  retailPercent: 20,
  wholesalePercent: 15,
  dealerPercent: 10,
  distributorPercent: 5,
  description: "Standard retail margin profile",
};

describe("createMarginProfileSchema", () => {
  it("accepts a complete valid MARGIN profile and trims the name", () => {
    const result = createMarginProfileSchema.parse({ ...VALID_INPUT, name: "  Retail Standard  " });

    expect(result.name).toBe("Retail Standard");
    expect(result.calculationMode).toBe("MARGIN");
    expect(result.retailPercent).toBe(20);
  });

  it("accepts 2-decimal percent values despite binary float imprecision", () => {
    // 18.15 * 100 is not exactly representable in binary floating point —
    // guards the tolerance in hasAtMostTwoDecimals.
    expect(
      createMarginProfileSchema.safeParse({ ...VALID_INPUT, retailPercent: 18.15 }).success
    ).toBe(true);
  });

  it("rejects more than 2 decimal places on any tier percent", () => {
    for (const field of [
      "retailPercent",
      "wholesalePercent",
      "dealerPercent",
      "distributorPercent",
    ]) {
      expect(
        createMarginProfileSchema.safeParse({ ...VALID_INPUT, [field]: 10.001 }).success
      ).toBe(false);
    }
  });

  it("rejects a negative percent on any tier", () => {
    for (const field of [
      "retailPercent",
      "wholesalePercent",
      "dealerPercent",
      "distributorPercent",
    ]) {
      expect(createMarginProfileSchema.safeParse({ ...VALID_INPUT, [field]: -1 }).success).toBe(
        false
      );
    }
  });

  describe("MARGIN mode bound (< 100)", () => {
    it("rejects any tier percent >= 100", () => {
      for (const field of [
        "retailPercent",
        "wholesalePercent",
        "dealerPercent",
        "distributorPercent",
      ]) {
        expect(
          createMarginProfileSchema.safeParse({ ...VALID_INPUT, [field]: 100 }).success
        ).toBe(false);
        expect(
          createMarginProfileSchema.safeParse({ ...VALID_INPUT, [field]: 150 }).success
        ).toBe(false);
      }
    });

    it("accepts a tier percent just under 100", () => {
      expect(
        createMarginProfileSchema.safeParse({ ...VALID_INPUT, retailPercent: 99.99 }).success
      ).toBe(true);
    });
  });

  describe("MARKUP mode bound (<= 999.99)", () => {
    const MARKUP_INPUT = { ...VALID_INPUT, calculationMode: "MARKUP" as const };

    it("accepts a tier percent >= 100", () => {
      expect(
        createMarginProfileSchema.safeParse({ ...MARKUP_INPUT, retailPercent: 150 }).success
      ).toBe(true);
      expect(
        createMarginProfileSchema.safeParse({ ...MARKUP_INPUT, retailPercent: 999.99 }).success
      ).toBe(true);
    });

    it("rejects a tier percent above 999.99", () => {
      expect(
        createMarginProfileSchema.safeParse({ ...MARKUP_INPUT, retailPercent: 1000 }).success
      ).toBe(false);
    });
  });

  it("rejects an invalid calculation mode", () => {
    expect(
      createMarginProfileSchema.safeParse({ ...VALID_INPUT, calculationMode: "DISCOUNT" }).success
    ).toBe(false);
  });

  it("requires all four tier percents", () => {
    expect(
      createMarginProfileSchema.safeParse({
        name: VALID_INPUT.name,
        calculationMode: VALID_INPUT.calculationMode,
        wholesalePercent: VALID_INPUT.wholesalePercent,
        dealerPercent: VALID_INPUT.dealerPercent,
        distributorPercent: VALID_INPUT.distributorPercent,
      }).success
    ).toBe(false);
  });

  it("rejects a too-short or too-long name", () => {
    expect(createMarginProfileSchema.safeParse({ ...VALID_INPUT, name: "R" }).success).toBe(false);
    expect(
      createMarginProfileSchema.safeParse({ ...VALID_INPUT, name: "x".repeat(101) }).success
    ).toBe(false);
  });

  it("normalizes a blank description to undefined", () => {
    const result = createMarginProfileSchema.parse({ ...VALID_INPUT, description: "   " });
    expect(result.description).toBeUndefined();
  });

  it("accepts an omitted optional description", () => {
    const result = createMarginProfileSchema.parse({
      name: VALID_INPUT.name,
      calculationMode: VALID_INPUT.calculationMode,
      retailPercent: VALID_INPUT.retailPercent,
      wholesalePercent: VALID_INPUT.wholesalePercent,
      dealerPercent: VALID_INPUT.dealerPercent,
      distributorPercent: VALID_INPUT.distributorPercent,
    });
    expect(result.description).toBeUndefined();
  });
});
