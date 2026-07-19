import { describe, expect, it } from "vitest";

import {
  createPriceListSchema,
  priceListItemSchema,
} from "@/modules/price-lists/validation/price-list-schema";

const VALID_HEADER = {
  name: "Wholesale Standard",
  customerType: "WHOLESALE" as const,
  effectiveFrom: "2026-01-01",
  effectiveTo: "2026-12-31",
  description: "Standard wholesale price list",
};

describe("createPriceListSchema", () => {
  it("accepts a complete valid header and trims the name", () => {
    const result = createPriceListSchema.parse({ ...VALID_HEADER, name: "  Wholesale Standard  " });
    expect(result.name).toBe("Wholesale Standard");
    expect(result.customerType).toBe("WHOLESALE");
  });

  it("accepts an always-effective, tier-agnostic list with everything optional omitted", () => {
    const result = createPriceListSchema.parse({ name: "Everyone Everywhere" });
    expect(result.customerType).toBeUndefined();
    expect(result.effectiveFrom).toBeUndefined();
    expect(result.effectiveTo).toBeUndefined();
  });

  it("accepts a one-sided window (only effectiveFrom)", () => {
    expect(
      createPriceListSchema.safeParse({ name: "Starts Someday", effectiveFrom: "2026-06-01" }).success
    ).toBe(true);
  });

  it("rejects a too-short or too-long name", () => {
    expect(createPriceListSchema.safeParse({ ...VALID_HEADER, name: "R" }).success).toBe(false);
    expect(
      createPriceListSchema.safeParse({ ...VALID_HEADER, name: "x".repeat(101) }).success
    ).toBe(false);
  });

  it("rejects an invalid customer type", () => {
    expect(
      createPriceListSchema.safeParse({ ...VALID_HEADER, customerType: "VIP" }).success
    ).toBe(false);
  });

  it("rejects a malformed effective date", () => {
    expect(
      createPriceListSchema.safeParse({ ...VALID_HEADER, effectiveFrom: "2026/01/01" }).success
    ).toBe(false);
  });

  it("rejects a calendar date that rolls over (e.g. 2026-02-30)", () => {
    expect(
      createPriceListSchema.safeParse({ ...VALID_HEADER, effectiveTo: "2026-02-30" }).success
    ).toBe(false);
  });

  it("accepts effectiveFrom equal to effectiveTo (a single-day window)", () => {
    expect(
      createPriceListSchema.safeParse({
        ...VALID_HEADER,
        effectiveFrom: "2026-06-01",
        effectiveTo: "2026-06-01",
      }).success
    ).toBe(true);
  });

  it("rejects effectiveFrom after effectiveTo", () => {
    const result = createPriceListSchema.safeParse({
      ...VALID_HEADER,
      effectiveFrom: "2026-12-31",
      effectiveTo: "2026-01-01",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].path).toEqual(["effectiveTo"]);
    }
  });

  it("normalizes a blank description to undefined", () => {
    const result = createPriceListSchema.parse({ ...VALID_HEADER, description: "   " });
    expect(result.description).toBeUndefined();
  });
});

const VALID_ITEM = {
  productId: "11111111-1111-4111-8111-111111111111",
  sellingPrice: 150.5,
  minQuantity: 10,
};

describe("priceListItemSchema", () => {
  it("accepts a complete valid item row", () => {
    const result = priceListItemSchema.parse(VALID_ITEM);
    expect(result.sellingPrice).toBe(150.5);
    expect(result.minQuantity).toBe(10);
  });

  it("accepts an omitted minQuantity (defaulted downstream to 1)", () => {
    const result = priceListItemSchema.parse({
      productId: VALID_ITEM.productId,
      sellingPrice: 100,
    });
    expect(result.minQuantity).toBeUndefined();
  });

  it("rejects a non-uuid productId", () => {
    expect(
      priceListItemSchema.safeParse({ ...VALID_ITEM, productId: "not-a-uuid" }).success
    ).toBe(false);
  });

  it("rejects a negative selling price", () => {
    expect(priceListItemSchema.safeParse({ ...VALID_ITEM, sellingPrice: -1 }).success).toBe(false);
  });

  it("accepts a 2-decimal selling price despite binary float imprecision", () => {
    // 18.15 * 100 is not exactly representable in binary floating point —
    // guards the tolerance in hasAtMostDecimals.
    expect(priceListItemSchema.safeParse({ ...VALID_ITEM, sellingPrice: 18.15 }).success).toBe(
      true
    );
  });

  it("rejects a selling price with more than 2 decimal places", () => {
    expect(priceListItemSchema.safeParse({ ...VALID_ITEM, sellingPrice: 10.001 }).success).toBe(
      false
    );
  });

  it("rejects a minQuantity below 0.0001", () => {
    expect(priceListItemSchema.safeParse({ ...VALID_ITEM, minQuantity: 0 }).success).toBe(false);
  });

  it("rejects a minQuantity with more than 4 decimal places", () => {
    expect(
      priceListItemSchema.safeParse({ ...VALID_ITEM, minQuantity: 1.00001 }).success
    ).toBe(false);
  });
});
