import { Prisma } from "@prisma/client";
import { describe, expect, it, vi, beforeEach } from "vitest";

// Mirrors voucher-engine.test.ts's convention — mock the module-boundary
// repository this engine calls through, plus the shared transaction helper,
// so recordMovements/transferStock's own-transaction path runs the callback
// against a fake tx instead of a real database, and the isolation options
// passed to runInTransaction can be asserted directly.
const {
  findProductsForMovementMock,
  findWarehousesForMovementMock,
  findAllowNegativeStockMock,
  sumStockForPairsMock,
  createManyMock,
  createTransferPairMock,
  runInTransactionMock,
  FAKE_TX,
} = vi.hoisted(() => ({
  findProductsForMovementMock: vi.fn(),
  findWarehousesForMovementMock: vi.fn(),
  findAllowNegativeStockMock: vi.fn(),
  sumStockForPairsMock: vi.fn(),
  createManyMock: vi.fn(),
  createTransferPairMock: vi.fn(),
  runInTransactionMock: vi.fn(),
  FAKE_TX: { marker: "fake-tx" },
}));

vi.mock("@/modules/stock-transactions/repositories/stock-transaction-repository", () => ({
  stockTransactionRepository: {
    findProductsForMovement: findProductsForMovementMock,
    findWarehousesForMovement: findWarehousesForMovementMock,
    findAllowNegativeStock: findAllowNegativeStockMock,
    sumStockForPairs: sumStockForPairsMock,
    createMany: createManyMock,
    createTransferPair: createTransferPairMock,
  },
}));

vi.mock("@/lib/transaction", () => ({
  runInTransaction: runInTransactionMock,
}));

import { AppError } from "@/lib/app-error";
import { recordMovement, recordMovements, transferStock } from "@/engines/inventory/inventory-engine";

const COMPANY_ID = "11111111-1111-4111-8111-111111111111";
const OTHER_COMPANY_ID = "99999999-9999-4999-8999-999999999999";
const PRODUCT_A = "22222222-2222-4222-8222-222222222222";
const PRODUCT_B = "88888888-8888-4888-8888-888888888888";
const WAREHOUSE_A = "33333333-3333-4333-8333-333333333333";
const WAREHOUSE_B = "44444444-4444-4444-8444-444444444444";

const TRADING_PRODUCT_A = {
  id: PRODUCT_A,
  companyId: COMPANY_ID,
  name: "Widget",
  isActive: true,
  productType: "TRADING" as const,
  unit: { decimalPlaces: 2 },
};

const TRADING_PRODUCT_B = {
  id: PRODUCT_B,
  companyId: COMPANY_ID,
  name: "Gadget",
  isActive: true,
  productType: "TRADING" as const,
  unit: { decimalPlaces: 0 },
};

const ACTIVE_WAREHOUSE_A = { id: WAREHOUSE_A, companyId: COMPANY_ID, name: "Main Store", isActive: true };
const ACTIVE_WAREHOUSE_B = { id: WAREHOUSE_B, companyId: COMPANY_ID, name: "Branch Store", isActive: true };

function purchaseLine(overrides: Record<string, unknown> = {}) {
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

function salesLine(overrides: Record<string, unknown> = {}) {
  return {
    productId: PRODUCT_A,
    warehouseId: WAREHOUSE_A,
    transactionType: "SALES",
    direction: "OUT",
    quantity: 4,
    transactionDate: "2026-07-01",
    ...overrides,
  };
}

beforeEach(() => {
  findProductsForMovementMock.mockReset().mockResolvedValue([TRADING_PRODUCT_A, TRADING_PRODUCT_B]);
  findWarehousesForMovementMock.mockReset().mockResolvedValue([ACTIVE_WAREHOUSE_A, ACTIVE_WAREHOUSE_B]);
  findAllowNegativeStockMock.mockReset().mockResolvedValue(false);
  sumStockForPairsMock.mockReset().mockResolvedValue(new Map());
  createManyMock.mockReset().mockResolvedValue([{ id: "st-1" }]);
  createTransferPairMock.mockReset().mockResolvedValue({ outTransaction: { id: "out-1" }, inTransaction: { id: "in-1" } });
  runInTransactionMock.mockReset().mockImplementation(async (fn: (tx: unknown) => unknown) => fn(FAKE_TX));
});

describe("recordMovements — type/direction matrix", () => {
  it("rejects PURCHASE + OUT before any repository call", async () => {
    await expect(
      recordMovements(COMPANY_ID, [purchaseLine({ direction: "OUT" })])
    ).rejects.toThrow("PURCHASE movements must be IN.");
    expect(findProductsForMovementMock).not.toHaveBeenCalled();
  });

  it("rejects SALES + IN", async () => {
    await expect(recordMovements(COMPANY_ID, [salesLine({ direction: "IN" })])).rejects.toThrow(
      "SALES movements must be OUT."
    );
  });

  it("rejects OPENING_STOCK + OUT", async () => {
    await expect(
      recordMovements(COMPANY_ID, [purchaseLine({ transactionType: "OPENING_STOCK", direction: "OUT" })])
    ).rejects.toThrow("OPENING_STOCK movements must be IN.");
  });

  it("rejects a lone TRANSFER line submitted directly", async () => {
    await expect(
      recordMovements(COMPANY_ID, [purchaseLine({ transactionType: "TRANSFER", direction: "IN" })])
    ).rejects.toThrow("transferStock");
  });

  it("accepts every documented valid combination", async () => {
    const validCombinations = [
      { transactionType: "OPENING_STOCK", direction: "IN" },
      { transactionType: "PURCHASE", direction: "IN" },
      { transactionType: "PURCHASE_RETURN", direction: "OUT" },
      { transactionType: "SALES", direction: "OUT" },
      { transactionType: "SALES_RETURN", direction: "IN" },
      { transactionType: "ADJUSTMENT", direction: "IN" },
      { transactionType: "ADJUSTMENT", direction: "OUT" },
      { transactionType: "PHYSICAL_VERIFICATION", direction: "IN" },
      { transactionType: "PHYSICAL_VERIFICATION", direction: "OUT" },
    ] as const;

    for (const combo of validCombinations) {
      sumStockForPairsMock.mockResolvedValue(new Map([[`${PRODUCT_A}::${WAREHOUSE_A}`, 100]]));
      await expect(recordMovements(COMPANY_ID, [purchaseLine(combo)])).resolves.toBeDefined();
    }
  });
});

describe("recordMovements — reference validation", () => {
  it("rejects a product from another company", async () => {
    findProductsForMovementMock.mockResolvedValue([{ ...TRADING_PRODUCT_A, companyId: OTHER_COMPANY_ID }]);
    await expect(recordMovements(COMPANY_ID, [purchaseLine()])).rejects.toThrow("Product not found.");
  });

  it("rejects an inactive product", async () => {
    findProductsForMovementMock.mockResolvedValue([{ ...TRADING_PRODUCT_A, isActive: false }]);
    await expect(recordMovements(COMPANY_ID, [purchaseLine()])).rejects.toThrow("is inactive");
  });

  it("rejects a non-TRADING product", async () => {
    findProductsForMovementMock.mockResolvedValue([{ ...TRADING_PRODUCT_A, productType: "SERVICE" }]);
    await expect(recordMovements(COMPANY_ID, [purchaseLine()])).rejects.toThrow("not a trading product");
  });

  it("rejects an inactive warehouse", async () => {
    findWarehousesForMovementMock.mockResolvedValue([{ ...ACTIVE_WAREHOUSE_A, isActive: false }]);
    await expect(recordMovements(COMPANY_ID, [purchaseLine()])).rejects.toThrow("is inactive");
  });

  it("rejects a warehouse from another company", async () => {
    findWarehousesForMovementMock.mockResolvedValue([{ ...ACTIVE_WAREHOUSE_A, companyId: OTHER_COMPANY_ID }]);
    await expect(recordMovements(COMPANY_ID, [purchaseLine()])).rejects.toThrow("Warehouse not found.");
  });
});

describe("recordMovements — quantity precision", () => {
  it("rejects a quantity with more decimals than the product's unit allows", async () => {
    await expect(recordMovements(COMPANY_ID, [purchaseLine({ quantity: 10.123 })])).rejects.toThrow(
      "at most 2 decimal places"
    );
  });

  it("rejects a fractional quantity for a whole-number unit", async () => {
    await expect(
      recordMovements(COMPANY_ID, [purchaseLine({ productId: PRODUCT_B, quantity: 10.5 })])
    ).rejects.toThrow("whole number");
  });

  it("accepts a quantity within the unit's decimal bound", async () => {
    await expect(recordMovements(COMPANY_ID, [purchaseLine({ quantity: 10.25 })])).resolves.toBeDefined();
  });
});

describe("recordMovements — future-dated movements", () => {
  it("rejects a transaction date in the future", async () => {
    await expect(
      recordMovements(COMPANY_ID, [purchaseLine({ transactionDate: "2099-01-01" })])
    ).rejects.toThrow("cannot be in the future");
  });
});

describe("recordMovements — availability matrix", () => {
  it("allows an OUT movement that exactly zeroes current stock", async () => {
    sumStockForPairsMock.mockResolvedValue(new Map([[`${PRODUCT_A}::${WAREHOUSE_A}`, 4]]));
    await expect(recordMovements(COMPANY_ID, [salesLine({ quantity: 4 })])).resolves.toBeDefined();
  });

  it("rejects an OUT movement exceeding current stock when allowNegativeStock is off", async () => {
    findAllowNegativeStockMock.mockResolvedValue(false);
    sumStockForPairsMock.mockResolvedValue(new Map([[`${PRODUCT_A}::${WAREHOUSE_A}`, 3]]));
    await expect(recordMovements(COMPANY_ID, [salesLine({ quantity: 4 })])).rejects.toThrow("Insufficient stock");
    expect(createManyMock).not.toHaveBeenCalled();
  });

  it("allows an OUT movement exceeding current stock when allowNegativeStock is on", async () => {
    findAllowNegativeStockMock.mockResolvedValue(true);
    await expect(recordMovements(COMPANY_ID, [salesLine({ quantity: 4 })])).resolves.toBeDefined();
    // The availability read is skipped entirely once negative stock is allowed.
    expect(sumStockForPairsMock).not.toHaveBeenCalled();
  });

  it("validates batch demand aggregated per (product, warehouse), not per line", async () => {
    // Three lines of 4 units each must not individually pass against a stock of 10.
    sumStockForPairsMock.mockResolvedValue(new Map([[`${PRODUCT_A}::${WAREHOUSE_A}`, 10]]));
    await expect(
      recordMovements(COMPANY_ID, [salesLine({ quantity: 4 }), salesLine({ quantity: 4 }), salesLine({ quantity: 4 })])
    ).rejects.toThrow("Insufficient stock");
  });

  it("does not net IN lines against OUT lines in the same batch", async () => {
    sumStockForPairsMock.mockResolvedValue(new Map([[`${PRODUCT_A}::${WAREHOUSE_A}`, 2]]));
    await expect(
      recordMovements(COMPANY_ID, [salesLine({ quantity: 4 }), purchaseLine({ quantity: 100 })])
    ).rejects.toThrow("Insufficient stock");
  });
});

describe("recordMovements — isolation", () => {
  it("uses Serializable isolation with retry when the batch contains an OUT line", async () => {
    sumStockForPairsMock.mockResolvedValue(new Map([[`${PRODUCT_A}::${WAREHOUSE_A}`, 100]]));
    await recordMovements(COMPANY_ID, [salesLine()]);

    expect(runInTransactionMock).toHaveBeenCalledTimes(1);
    const options = runInTransactionMock.mock.calls[0][1];
    expect(options).toMatchObject({ isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    expect(options.retryable).toBeInstanceOf(Function);
  });

  it("uses no isolation options for an IN-only batch", async () => {
    await recordMovements(COMPANY_ID, [purchaseLine()]);

    expect(runInTransactionMock).toHaveBeenCalledTimes(1);
    expect(runInTransactionMock.mock.calls[0][1]).toBeUndefined();
  });

  it("uses the passed transaction directly and never calls runInTransaction", async () => {
    const callerTx = { marker: "caller-tx" } as never;
    await recordMovements(COMPANY_ID, [purchaseLine()], callerTx);

    expect(runInTransactionMock).not.toHaveBeenCalled();
    expect(createManyMock).toHaveBeenCalledWith(callerTx, COMPANY_ID, expect.any(Array));
  });
});

describe("recordMovement — single-line convenience wrapper", () => {
  it("records one line and returns the single created row", async () => {
    createManyMock.mockResolvedValue([{ id: "st-1", productId: PRODUCT_A }]);
    const result = await recordMovement(COMPANY_ID, purchaseLine());
    expect(result).toEqual({ id: "st-1", productId: PRODUCT_A });
  });
});

describe("transferStock", () => {
  function transferInput(overrides: Record<string, unknown> = {}) {
    return {
      productId: PRODUCT_A,
      sourceWarehouseId: WAREHOUSE_A,
      destinationWarehouseId: WAREHOUSE_B,
      quantity: 5,
      transactionDate: "2026-07-01",
      ...overrides,
    };
  }

  it("writes exactly two linked rows atomically", async () => {
    sumStockForPairsMock.mockResolvedValue(new Map([[`${PRODUCT_A}::${WAREHOUSE_A}`, 10]]));
    const result = await transferStock(COMPANY_ID, transferInput());

    expect(result.outTransaction.id).toBe("out-1");
    expect(result.inTransaction.id).toBe("in-1");
    expect(createTransferPairMock).toHaveBeenCalledTimes(1);
  });

  it("never moves stock a source warehouse doesn't have, with the setting off", async () => {
    findAllowNegativeStockMock.mockResolvedValue(false);
    sumStockForPairsMock.mockResolvedValue(new Map([[`${PRODUCT_A}::${WAREHOUSE_A}`, 2]]));
    await expect(transferStock(COMPANY_ID, transferInput({ quantity: 5 }))).rejects.toThrow("Insufficient stock");
    expect(createTransferPairMock).not.toHaveBeenCalled();
  });

  it("allows the transfer with the setting on even when the source is short", async () => {
    findAllowNegativeStockMock.mockResolvedValue(true);
    await expect(transferStock(COMPANY_ID, transferInput({ quantity: 5 }))).resolves.toBeDefined();
  });

  it("uses Serializable isolation with retry", async () => {
    sumStockForPairsMock.mockResolvedValue(new Map([[`${PRODUCT_A}::${WAREHOUSE_A}`, 10]]));
    await transferStock(COMPANY_ID, transferInput());

    const options = runInTransactionMock.mock.calls[0][1];
    expect(options).toMatchObject({ isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  });

  it("rejects a future transaction date", async () => {
    await expect(transferStock(COMPANY_ID, transferInput({ transactionDate: "2099-01-01" }))).rejects.toThrow(
      "cannot be in the future"
    );
  });

  it("rejects source and destination being the same warehouse", async () => {
    await expect(
      transferStock(COMPANY_ID, transferInput({ destinationWarehouseId: WAREHOUSE_A }))
    ).rejects.toThrow();
  });
});

describe("AppError propagation", () => {
  it("rejection errors are instances of AppError, safe to surface to the client", async () => {
    await expect(recordMovements(COMPANY_ID, [purchaseLine({ direction: "OUT" })])).rejects.toBeInstanceOf(AppError);
  });
});
