import { describe, expect, it } from "vitest";

import {
  applyProfile,
  isPriceListEffective,
  pickBreakRow,
  resolveEffectiveTier,
  resolveFromSources,
  type MarginProfileLike,
  type PriceListLike,
  type ResolveFromSourcesInput,
} from "@/engines/pricing/price-resolution";

const PRODUCT_ID = "product-1";
const OTHER_PRODUCT_ID = "product-2";

describe("pickBreakRow", () => {
  const items = [
    { id: "item-1", productId: PRODUCT_ID, sellingPrice: 100, minQuantity: 1 },
    { id: "item-2", productId: PRODUCT_ID, sellingPrice: 95, minQuantity: 10 },
    { id: "item-3", productId: PRODUCT_ID, sellingPrice: 90, minQuantity: 50 },
    { id: "item-4", productId: OTHER_PRODUCT_ID, sellingPrice: 10, minQuantity: 1 },
  ];

  it("picks the exact-break row when quantity matches a minQuantity exactly", () => {
    expect(pickBreakRow(items, PRODUCT_ID, 10)?.id).toBe("item-2");
  });

  it("picks the highest break strictly below the ordered quantity (between breaks)", () => {
    expect(pickBreakRow(items, PRODUCT_ID, 25)?.id).toBe("item-2");
  });

  it("picks the top break when quantity is above every break", () => {
    expect(pickBreakRow(items, PRODUCT_ID, 1000)?.id).toBe("item-3");
  });

  it("returns null when quantity is below the lowest break", () => {
    const noBaseRow = items.filter((item) => item.minQuantity !== 1);
    expect(pickBreakRow(noBaseRow, PRODUCT_ID, 5)).toBeNull();
  });

  it("supports decimal quantities and decimal breaks", () => {
    const decimalItems = [
      { id: "d-1", productId: PRODUCT_ID, sellingPrice: 100, minQuantity: 1.5 },
      { id: "d-2", productId: PRODUCT_ID, sellingPrice: 95, minQuantity: 2.25 },
    ];
    expect(pickBreakRow(decimalItems, PRODUCT_ID, 2)?.id).toBe("d-1");
    expect(pickBreakRow(decimalItems, PRODUCT_ID, 2.25)?.id).toBe("d-2");
    expect(pickBreakRow(decimalItems, PRODUCT_ID, 1.4)).toBeNull();
  });

  it("ignores rows for a different product", () => {
    expect(pickBreakRow(items, "product-does-not-exist", 100)).toBeNull();
  });

  it("returns null for an empty item list", () => {
    expect(pickBreakRow([], PRODUCT_ID, 1)).toBeNull();
  });
});

describe("isPriceListEffective", () => {
  const asOfDate = new Date("2026-07-19T00:00:00.000Z");

  it("is false for an inactive list regardless of window", () => {
    expect(
      isPriceListEffective({ isActive: false, effectiveFrom: null, effectiveTo: null }, asOfDate)
    ).toBe(false);
  });

  it("is true when both bounds are open-ended (always effective)", () => {
    expect(
      isPriceListEffective({ isActive: true, effectiveFrom: null, effectiveTo: null }, asOfDate)
    ).toBe(true);
  });

  it("is true on the inclusive effectiveFrom boundary", () => {
    expect(
      isPriceListEffective(
        { isActive: true, effectiveFrom: asOfDate, effectiveTo: null },
        asOfDate
      )
    ).toBe(true);
  });

  it("is true on the inclusive effectiveTo boundary", () => {
    expect(
      isPriceListEffective({ isActive: true, effectiveFrom: null, effectiveTo: asOfDate }, asOfDate)
    ).toBe(true);
  });

  it("is false before an open-ended-start effectiveFrom", () => {
    const future = new Date("2026-08-01T00:00:00.000Z");
    expect(
      isPriceListEffective({ isActive: true, effectiveFrom: future, effectiveTo: null }, asOfDate)
    ).toBe(false);
  });

  it("is false after an open-ended-end effectiveTo", () => {
    const past = new Date("2026-07-01T00:00:00.000Z");
    expect(
      isPriceListEffective({ isActive: true, effectiveFrom: null, effectiveTo: past }, asOfDate)
    ).toBe(false);
  });

  it("is true strictly inside a two-sided window", () => {
    expect(
      isPriceListEffective(
        {
          isActive: true,
          effectiveFrom: new Date("2026-07-01T00:00:00.000Z"),
          effectiveTo: new Date("2026-07-31T00:00:00.000Z"),
        },
        asOfDate
      )
    ).toBe(true);
  });

  it("ignores time-of-day, comparing calendar days only", () => {
    const laterSameDay = new Date("2026-07-19T23:59:59.000Z");
    expect(
      isPriceListEffective(
        { isActive: true, effectiveFrom: laterSameDay, effectiveTo: null },
        new Date("2026-07-19T00:00:00.000Z")
      )
    ).toBe(true);
  });
});

describe("resolveEffectiveTier", () => {
  it("uses the customer's stored tier when a customer was loaded", () => {
    expect(resolveEffectiveTier("WHOLESALE", "DEALER")).toBe("WHOLESALE");
  });

  it("falls back to the explicit tier when no customer was loaded", () => {
    expect(resolveEffectiveTier(undefined, "DEALER")).toBe("DEALER");
    expect(resolveEffectiveTier(null, "DISTRIBUTOR")).toBe("DISTRIBUTOR");
  });

  it("defaults to RETAIL (Walk-in) when neither is given", () => {
    expect(resolveEffectiveTier(undefined, undefined)).toBe("RETAIL");
    expect(resolveEffectiveTier(null, undefined)).toBe("RETAIL");
  });
});

describe("applyProfile", () => {
  const profile: MarginProfileLike = {
    id: "profile-1",
    calculationMode: "MARKUP",
    retailPercent: 20,
    wholesalePercent: 15,
    dealerPercent: 10,
    distributorPercent: 5,
  };

  it("computes MARKUP: price = cost * (1 + percent / 100)", () => {
    expect(applyProfile(profile, "RETAIL", 100)).toBe(120);
  });

  it("computes MARGIN: price = cost / (1 - percent / 100)", () => {
    const marginProfile: MarginProfileLike = { ...profile, calculationMode: "MARGIN" };
    expect(applyProfile(marginProfile, "RETAIL", 100)).toBe(125);
  });

  it("selects the percent matching each of the four tiers", () => {
    expect(applyProfile(profile, "RETAIL", 100)).toBe(120);
    expect(applyProfile(profile, "WHOLESALE", 100)).toBe(115);
    expect(applyProfile(profile, "DEALER", 100)).toBe(110);
    expect(applyProfile(profile, "DISTRIBUTOR", 100)).toBe(105);
  });

  it("rounds the result half-up to 2 decimals", () => {
    // 100 / (1 - 33/100) = 149.253731... -> 149.25
    const marginProfile: MarginProfileLike = { ...profile, calculationMode: "MARGIN" };
    expect(applyProfile(marginProfile, "RETAIL", 100)).toBe(125);
    expect(
      applyProfile({ ...marginProfile, retailPercent: 33 }, "RETAIL", 100)
    ).toBe(149.25);
    // 100 * (1 + 12.345/100) = 112.345 -> half-up to 112.35 (not 112.34)
    expect(applyProfile({ ...profile, retailPercent: 12.345 }, "RETAIL", 100)).toBe(112.35);
  });

  it("computes correctly near the MARGIN mode's <100 domain boundary", () => {
    const marginProfile: MarginProfileLike = { ...profile, calculationMode: "MARGIN", retailPercent: 99 };
    // 100 / (1 - 99/100) = 100 / 0.01 = 10000
    expect(applyProfile(marginProfile, "RETAIL", 100)).toBe(10000);
  });
});

function priceList(overrides: Partial<PriceListLike> = {}): PriceListLike {
  return {
    id: "list-1",
    customerType: null,
    items: [],
    ...overrides,
  };
}

function baseSourcesInput(overrides: Partial<ResolveFromSourcesInput> = {}): ResolveFromSourcesInput {
  return {
    productId: PRODUCT_ID,
    quantity: 5,
    tier: "RETAIL",
    purchaseCost: 100,
    productSellingPrice: 90,
    customerAssignedList: null,
    tierMatchingLists: [],
    tierAgnosticLists: [],
    marginProfile: null,
    ...overrides,
  };
}

const MARGIN_PROFILE: MarginProfileLike = {
  id: "profile-1",
  calculationMode: "MARKUP",
  retailPercent: 20,
  wholesalePercent: 15,
  dealerPercent: 10,
  distributorPercent: 5,
};

describe("resolveFromSources — source-order matrix", () => {
  it("1. customer's assigned list wins even when a tier-matching list is cheaper", () => {
    const input = baseSourcesInput({
      customerAssignedList: priceList({
        id: "assigned-list",
        items: [{ id: "assigned-item", productId: PRODUCT_ID, sellingPrice: 80, minQuantity: 1 }],
      }),
      tierMatchingLists: [
        priceList({
          id: "cheaper-tier-list",
          customerType: "RETAIL",
          items: [{ id: "cheap-item", productId: PRODUCT_ID, sellingPrice: 50, minQuantity: 1 }],
        }),
      ],
    });

    const result = resolveFromSources(input);
    expect(result).toMatchObject({
      price: 80,
      source: "CUSTOMER_PRICE_LIST",
      priceListId: "assigned-list",
      priceListItemId: "assigned-item",
    });
  });

  it("1. is skipped (falls through) when the assigned list has no row for this product", () => {
    const input = baseSourcesInput({
      customerAssignedList: priceList({ id: "assigned-list", items: [] }),
      tierMatchingLists: [
        priceList({
          items: [{ id: "tier-item", productId: PRODUCT_ID, sellingPrice: 70, minQuantity: 1 }],
        }),
      ],
    });

    expect(resolveFromSources(input)).toMatchObject({ price: 70, source: "PRICE_LIST" });
  });

  it("1. is skipped when quantity falls below the assigned list's lowest break", () => {
    const input = baseSourcesInput({
      quantity: 1,
      customerAssignedList: priceList({
        id: "assigned-list",
        items: [{ id: "assigned-item", productId: PRODUCT_ID, sellingPrice: 80, minQuantity: 10 }],
      }),
      marginProfile: MARGIN_PROFILE,
    });

    expect(resolveFromSources(input)).toMatchObject({ source: "MARGIN_PROFILE" });
  });

  it("2. tier-matching lists win over tier-agnostic lists, lowest price across the bucket", () => {
    const input = baseSourcesInput({
      tierMatchingLists: [
        priceList({
          id: "tier-list-a",
          customerType: "RETAIL",
          items: [{ id: "item-a", productId: PRODUCT_ID, sellingPrice: 75, minQuantity: 1 }],
        }),
        priceList({
          id: "tier-list-b",
          customerType: "RETAIL",
          items: [{ id: "item-b", productId: PRODUCT_ID, sellingPrice: 60, minQuantity: 1 }],
        }),
      ],
      tierAgnosticLists: [
        priceList({
          id: "agnostic-list",
          items: [{ id: "item-c", productId: PRODUCT_ID, sellingPrice: 10, minQuantity: 1 }],
        }),
      ],
    });

    const result = resolveFromSources(input);
    expect(result).toMatchObject({
      price: 60,
      source: "PRICE_LIST",
      priceListId: "tier-list-b",
      priceListItemId: "item-b",
    });
  });

  it("2. is skipped when no tier-matching list has a row for this product/quantity", () => {
    const input = baseSourcesInput({
      tierMatchingLists: [priceList({ id: "empty-tier-list", items: [] })],
      tierAgnosticLists: [
        priceList({
          id: "agnostic-list",
          items: [{ id: "item-c", productId: PRODUCT_ID, sellingPrice: 65, minQuantity: 1 }],
        }),
      ],
    });

    expect(resolveFromSources(input)).toMatchObject({
      price: 65,
      source: "PRICE_LIST",
      priceListId: "agnostic-list",
    });
  });

  it("3. tier-agnostic lists apply the same lowest-price rule", () => {
    const input = baseSourcesInput({
      tierAgnosticLists: [
        priceList({
          id: "agnostic-a",
          items: [{ id: "item-a", productId: PRODUCT_ID, sellingPrice: 55, minQuantity: 1 }],
        }),
        priceList({
          id: "agnostic-b",
          items: [{ id: "item-b", productId: PRODUCT_ID, sellingPrice: 45, minQuantity: 1 }],
        }),
      ],
    });

    expect(resolveFromSources(input)).toMatchObject({ price: 45, priceListId: "agnostic-b" });
  });

  it("ties within a bucket keep the first list encountered (documented tie-break)", () => {
    const input = baseSourcesInput({
      tierMatchingLists: [
        priceList({
          id: "first-list",
          items: [{ id: "item-first", productId: PRODUCT_ID, sellingPrice: 50, minQuantity: 1 }],
        }),
        priceList({
          id: "second-list",
          items: [{ id: "item-second", productId: PRODUCT_ID, sellingPrice: 50, minQuantity: 1 }],
        }),
      ],
    });

    expect(resolveFromSources(input)).toMatchObject({ priceListId: "first-list" });
  });

  it("4. Margin Profile applies when no price list matched", () => {
    const input = baseSourcesInput({ marginProfile: MARGIN_PROFILE, purchaseCost: 100 });

    expect(resolveFromSources(input)).toMatchObject({
      price: 120,
      source: "MARGIN_PROFILE",
      marginProfileId: "profile-1",
    });
  });

  it("4. is skipped when purchaseCost is null even if a profile is set", () => {
    const input = baseSourcesInput({ marginProfile: MARGIN_PROFILE, purchaseCost: null });

    expect(resolveFromSources(input)).toMatchObject({ source: "PRODUCT_DEFAULT", price: 90 });
  });

  it("4. is skipped when no profile was resolved (unset or inactive — caller passes null)", () => {
    const input = baseSourcesInput({ marginProfile: null });

    expect(resolveFromSources(input)).toMatchObject({ source: "PRODUCT_DEFAULT", price: 90 });
  });

  it("5. falls back to the product's own sellingPrice when nothing else matched", () => {
    const input = baseSourcesInput({ marginProfile: null, productSellingPrice: 42 });

    expect(resolveFromSources(input)).toMatchObject({ source: "PRODUCT_DEFAULT", price: 42 });
  });

  it("6. resolves to null/NONE when no source produced a price", () => {
    const input = baseSourcesInput({ marginProfile: null, productSellingPrice: null });

    expect(resolveFromSources(input)).toMatchObject({ price: null, source: "NONE" });
  });
});

describe("resolveFromSources — isBelowCost matrix", () => {
  it("flags true when the resolved price is below the purchase cost", () => {
    const input = baseSourcesInput({ productSellingPrice: 50, purchaseCost: 100, marginProfile: null });
    expect(resolveFromSources(input).isBelowCost).toBe(true);
  });

  it("flags false when the resolved price is at or above the purchase cost", () => {
    const atCost = baseSourcesInput({ productSellingPrice: 100, purchaseCost: 100, marginProfile: null });
    const aboveCost = baseSourcesInput({ productSellingPrice: 150, purchaseCost: 100, marginProfile: null });
    expect(resolveFromSources(atCost).isBelowCost).toBe(false);
    expect(resolveFromSources(aboveCost).isBelowCost).toBe(false);
  });

  it("flags false when purchaseCost is null (nothing to compare against)", () => {
    const input = baseSourcesInput({ productSellingPrice: 10, purchaseCost: null, marginProfile: null });
    expect(resolveFromSources(input).isBelowCost).toBe(false);
  });

  it("flags false when the resolved price is null", () => {
    const input = baseSourcesInput({ productSellingPrice: null, purchaseCost: 100, marginProfile: null });
    expect(resolveFromSources(input).isBelowCost).toBe(false);
  });

  it("a below-cost PRICE_LIST price is legal and still flagged", () => {
    const input = baseSourcesInput({
      purchaseCost: 100,
      tierAgnosticLists: [
        priceList({ items: [{ id: "promo", productId: PRODUCT_ID, sellingPrice: 40, minQuantity: 1 }] }),
      ],
    });
    const result = resolveFromSources(input);
    expect(result).toMatchObject({ price: 40, source: "PRICE_LIST", isBelowCost: true });
  });

  it("echoes purchaseCost regardless of which source resolved the price", () => {
    const input = baseSourcesInput({ purchaseCost: 77, productSellingPrice: 90, marginProfile: null });
    expect(resolveFromSources(input).purchaseCost).toBe(77);
  });
});
