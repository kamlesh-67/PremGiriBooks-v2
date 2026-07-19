import { describe, expect, it } from "vitest";

import {
  aggregateOutDemand,
  directionErrorMessage,
  hasAtMostTwoDecimals,
  hasSufficientStock,
  hasValidQuantityPrecision,
  isDirectionAllowed,
  isFutureTransactionDate,
  isValidCalendarDate,
  pairKey,
  recordMovementsInputSchema,
  stockMovementLineSchema,
  toUtcDate,
  transferStockInputSchema,
} from "@/engines/inventory/inventory-validation";

const PRODUCT_A = "11111111-1111-4111-8111-111111111111";
const PRODUCT_B = "99999999-9999-4999-8999-999999999999";
const WAREHOUSE_A = "22222222-2222-4222-8222-222222222222";
const WAREHOUSE_B = "33333333-3333-4333-8333-333333333333";

function validLine(overrides: Record<string, unknown> = {}) {
  return {
    productId: PRODUCT_A,
    warehouseId: WAREHOUSE_A,
    transactionType: "PURCHASE",
    direction: "IN",
    quantity: 10,
    transactionDate: "2026-07-01",
    ...overrides,
  };
}

describe("isValidCalendarDate", () => {
  it("accepts a well-formed calendar date", () => {
    expect(isValidCalendarDate("2026-07-19")).toBe(true);
  });

  it("rejects a non-YYYY-MM-DD string", () => {
    expect(isValidCalendarDate("19-07-2026")).toBe(false);
    expect(isValidCalendarDate("not-a-date")).toBe(false);
  });

  it("rejects a date that Date would silently roll over (e.g. Feb 30)", () => {
    expect(isValidCalendarDate("2026-02-30")).toBe(false);
  });
});

describe("toUtcDate", () => {
  it("parses to UTC midnight", () => {
    const date = toUtcDate("2026-07-19");
    expect(date.toISOString()).toBe("2026-07-19T00:00:00.000Z");
  });
});

describe("isFutureTransactionDate", () => {
  const now = new Date("2026-07-19T15:30:00.000Z");

  it("is false for a past date", () => {
    expect(isFutureTransactionDate(toUtcDate("2026-07-18"), now)).toBe(false);
  });

  it("is false for today", () => {
    expect(isFutureTransactionDate(toUtcDate("2026-07-19"), now)).toBe(false);
  });

  it("is true for a future date", () => {
    expect(isFutureTransactionDate(toUtcDate("2026-07-20"), now)).toBe(true);
  });
});

describe("hasAtMostTwoDecimals", () => {
  it("accepts whole numbers and 2-decimal values", () => {
    expect(hasAtMostTwoDecimals(100)).toBe(true);
    expect(hasAtMostTwoDecimals(18.15)).toBe(true);
  });

  it("rejects more than 2 decimal places", () => {
    expect(hasAtMostTwoDecimals(18.155)).toBe(false);
  });
});

describe("hasValidQuantityPrecision", () => {
  it("requires a whole number when decimalPlaces is 0", () => {
    expect(hasValidQuantityPrecision(5, 0)).toBe(true);
    expect(hasValidQuantityPrecision(5.5, 0)).toBe(false);
  });

  it("allows up to the unit's decimalPlaces", () => {
    expect(hasValidQuantityPrecision(5.1234, 4)).toBe(true);
    expect(hasValidQuantityPrecision(5.12345, 4)).toBe(false);
  });

  it("allows 2-decimal quantities for a 2-decimal unit", () => {
    expect(hasValidQuantityPrecision(5.25, 2)).toBe(true);
    expect(hasValidQuantityPrecision(5.255, 2)).toBe(false);
  });
});

describe("type/direction matrix", () => {
  const cases: Array<[string, "IN" | "OUT", boolean]> = [
    ["OPENING_STOCK", "IN", true],
    ["OPENING_STOCK", "OUT", false],
    ["PURCHASE", "IN", true],
    ["PURCHASE", "OUT", false],
    ["PURCHASE_RETURN", "OUT", true],
    ["PURCHASE_RETURN", "IN", false],
    ["SALES", "OUT", true],
    ["SALES", "IN", false],
    ["SALES_RETURN", "IN", true],
    ["SALES_RETURN", "OUT", false],
    ["ADJUSTMENT", "IN", true],
    ["ADJUSTMENT", "OUT", true],
    ["PHYSICAL_VERIFICATION", "IN", true],
    ["PHYSICAL_VERIFICATION", "OUT", true],
    ["TRANSFER", "IN", false],
    ["TRANSFER", "OUT", false],
  ];

  it.each(cases)("%s + %s -> allowed=%s", (transactionType, direction, expected) => {
    expect(isDirectionAllowed(transactionType as never, direction)).toBe(expected);
  });

  it("gives a TRANSFER-specific message pointing at transferStock", () => {
    expect(directionErrorMessage("TRANSFER")).toMatch(/transferStock/);
  });

  it("gives a type-specific message naming the allowed direction(s)", () => {
    expect(directionErrorMessage("SALES")).toBe("SALES movements must be OUT.");
    expect(directionErrorMessage("ADJUSTMENT")).toBe("ADJUSTMENT movements must be IN or OUT.");
  });
});

describe("hasSufficientStock", () => {
  it("allows drawing down to exactly zero", () => {
    expect(hasSufficientStock(10, 10)).toBe(true);
  });

  it("allows sufficient stock", () => {
    expect(hasSufficientStock(10, 4)).toBe(true);
  });

  it("rejects insufficient stock", () => {
    expect(hasSufficientStock(10, 11)).toBe(false);
  });

  it("tolerates float drift at the epsilon boundary", () => {
    expect(hasSufficientStock(0.3, 0.1 + 0.2)).toBe(true);
  });
});

describe("aggregateOutDemand", () => {
  it("sums OUT quantities per (product, warehouse) pair", () => {
    const demand = aggregateOutDemand([
      { productId: PRODUCT_A, warehouseId: WAREHOUSE_A, direction: "OUT", quantity: 4 },
      { productId: PRODUCT_A, warehouseId: WAREHOUSE_A, direction: "OUT", quantity: 4 },
      { productId: PRODUCT_A, warehouseId: WAREHOUSE_A, direction: "OUT", quantity: 4 },
    ]);

    expect(demand).toEqual([{ productId: PRODUCT_A, warehouseId: WAREHOUSE_A, quantity: 12 }]);
  });

  it("does not net IN lines against OUT lines in the same batch", () => {
    const demand = aggregateOutDemand([
      { productId: PRODUCT_A, warehouseId: WAREHOUSE_A, direction: "OUT", quantity: 10 },
      { productId: PRODUCT_A, warehouseId: WAREHOUSE_A, direction: "IN", quantity: 100 },
    ]);

    expect(demand).toEqual([{ productId: PRODUCT_A, warehouseId: WAREHOUSE_A, quantity: 10 }]);
  });

  it("keeps distinct (product, warehouse) pairs separate", () => {
    const demand = aggregateOutDemand([
      { productId: PRODUCT_A, warehouseId: WAREHOUSE_A, direction: "OUT", quantity: 4 },
      { productId: PRODUCT_B, warehouseId: WAREHOUSE_A, direction: "OUT", quantity: 5 },
      { productId: PRODUCT_A, warehouseId: WAREHOUSE_B, direction: "OUT", quantity: 6 },
    ]);

    expect(demand).toHaveLength(3);
  });

  it("returns an empty array when there are no OUT lines", () => {
    expect(aggregateOutDemand([{ productId: PRODUCT_A, warehouseId: WAREHOUSE_A, direction: "IN", quantity: 5 }])).toEqual(
      []
    );
  });
});

describe("pairKey", () => {
  it("is stable and distinct per (product, warehouse) combination", () => {
    expect(pairKey(PRODUCT_A, WAREHOUSE_A)).toBe(pairKey(PRODUCT_A, WAREHOUSE_A));
    expect(pairKey(PRODUCT_A, WAREHOUSE_A)).not.toBe(pairKey(PRODUCT_A, WAREHOUSE_B));
  });
});

describe("stockMovementLineSchema", () => {
  it("accepts a well-formed line", () => {
    expect(stockMovementLineSchema.safeParse(validLine()).success).toBe(true);
  });

  it("rejects a zero or negative quantity", () => {
    expect(stockMovementLineSchema.safeParse(validLine({ quantity: 0 })).success).toBe(false);
    expect(stockMovementLineSchema.safeParse(validLine({ quantity: -1 })).success).toBe(false);
  });

  it("rejects an invalid transaction date", () => {
    expect(stockMovementLineSchema.safeParse(validLine({ transactionDate: "not-a-date" })).success).toBe(false);
  });

  it("rejects an invalid unitCost with more than 2 decimals", () => {
    expect(stockMovementLineSchema.safeParse(validLine({ unitCost: 10.555 })).success).toBe(false);
  });

  it("requires referenceType and referenceId together, or neither", () => {
    expect(stockMovementLineSchema.safeParse(validLine({ referenceType: "SALES_INVOICE" })).success).toBe(false);
    expect(
      stockMovementLineSchema.safeParse(
        validLine({ referenceType: "SALES_INVOICE", referenceId: PRODUCT_B })
      ).success
    ).toBe(true);
  });
});

describe("recordMovementsInputSchema", () => {
  it("requires at least one line", () => {
    expect(recordMovementsInputSchema.safeParse([]).success).toBe(false);
  });

  it("accepts a batch of well-formed lines", () => {
    expect(recordMovementsInputSchema.safeParse([validLine(), validLine({ quantity: 5 })]).success).toBe(true);
  });
});

describe("transferStockInputSchema", () => {
  function validTransfer(overrides: Record<string, unknown> = {}) {
    return {
      productId: PRODUCT_A,
      sourceWarehouseId: WAREHOUSE_A,
      destinationWarehouseId: WAREHOUSE_B,
      quantity: 5,
      transactionDate: "2026-07-01",
      ...overrides,
    };
  }

  it("accepts a well-formed transfer", () => {
    expect(transferStockInputSchema.safeParse(validTransfer()).success).toBe(true);
  });

  it("rejects source and destination being the same warehouse", () => {
    expect(
      transferStockInputSchema.safeParse(validTransfer({ destinationWarehouseId: WAREHOUSE_A })).success
    ).toBe(false);
  });
});
