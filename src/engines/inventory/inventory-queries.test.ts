import { describe, expect, it, vi, beforeEach } from "vitest";

const {
  findProductsForMovementMock,
  aggregateCurrentStockMock,
  findLedgerTransactionsMock,
  aggregateStockByProductMock,
  findProductsForValuationMock,
} = vi.hoisted(() => ({
  findProductsForMovementMock: vi.fn(),
  aggregateCurrentStockMock: vi.fn(),
  findLedgerTransactionsMock: vi.fn(),
  aggregateStockByProductMock: vi.fn(),
  findProductsForValuationMock: vi.fn(),
}));

vi.mock("@/modules/stock-transactions/repositories/stock-transaction-repository", () => ({
  stockTransactionRepository: {
    findProductsForMovement: findProductsForMovementMock,
    aggregateCurrentStock: aggregateCurrentStockMock,
    findLedgerTransactions: findLedgerTransactionsMock,
    aggregateStockByProduct: aggregateStockByProductMock,
    findProductsForValuation: findProductsForValuationMock,
  },
}));

// inventory-queries.ts imports the module-level `prisma` client for a
// single company-scope check — mocked to a plain object so importing the
// real module doesn't try to construct a live client (customer-repository.
// test.ts's convention), since the repository call itself is mocked above.
vi.mock("@/lib/prisma", () => ({ prisma: {} }));

import { AppError } from "@/lib/app-error";
import { getCurrentStock, getStockLedger, getStockValuation } from "@/engines/inventory/inventory-queries";

const COMPANY_ID = "11111111-1111-4111-8111-111111111111";
const OTHER_COMPANY_ID = "99999999-9999-4999-8999-999999999999";
const PRODUCT_A = "22222222-2222-4222-8222-222222222222";
const PRODUCT_B = "88888888-8888-4888-8888-888888888888";
const WAREHOUSE_A = "33333333-3333-4333-8333-333333333333";

beforeEach(() => {
  findProductsForMovementMock.mockReset();
  aggregateCurrentStockMock.mockReset();
  findLedgerTransactionsMock.mockReset();
  aggregateStockByProductMock.mockReset();
  findProductsForValuationMock.mockReset();
});

describe("getCurrentStock", () => {
  it("delegates to the repository with the given filters", async () => {
    aggregateCurrentStockMock.mockResolvedValue([{ productId: PRODUCT_A, warehouseId: WAREHOUSE_A, quantity: 12 }]);

    const result = await getCurrentStock(COMPANY_ID, { productId: PRODUCT_A });

    expect(aggregateCurrentStockMock).toHaveBeenCalledWith(COMPANY_ID, { productId: PRODUCT_A });
    expect(result).toEqual([{ productId: PRODUCT_A, warehouseId: WAREHOUSE_A, quantity: 12 }]);
  });
});

describe("getStockLedger", () => {
  it("rejects a product that does not belong to the company", async () => {
    findProductsForMovementMock.mockResolvedValue([{ id: PRODUCT_A, companyId: OTHER_COMPANY_ID }]);
    await expect(getStockLedger(COMPANY_ID, PRODUCT_A)).rejects.toThrow("Product not found.");
  });

  it("rejects an unknown product", async () => {
    findProductsForMovementMock.mockResolvedValue([]);
    await expect(getStockLedger(COMPANY_ID, PRODUCT_A)).rejects.toThrow("Product not found.");
  });

  it("computes a running balance across dated movements", async () => {
    findProductsForMovementMock.mockResolvedValue([{ id: PRODUCT_A, companyId: COMPANY_ID }]);
    findLedgerTransactionsMock.mockResolvedValue([
      {
        id: "t1",
        transactionType: "OPENING_STOCK",
        direction: "IN",
        quantity: 10,
        unitCost: 100,
        transactionDate: new Date("2026-07-01T00:00:00.000Z"),
        warehouseId: WAREHOUSE_A,
        referenceType: null,
        referenceId: null,
        narration: null,
      },
      {
        id: "t2",
        transactionType: "SALES",
        direction: "OUT",
        quantity: 4,
        unitCost: null,
        transactionDate: new Date("2026-07-02T00:00:00.000Z"),
        warehouseId: WAREHOUSE_A,
        referenceType: null,
        referenceId: null,
        narration: null,
      },
      {
        id: "t3",
        transactionType: "PURCHASE",
        direction: "IN",
        quantity: 5,
        unitCost: 105,
        transactionDate: new Date("2026-07-03T00:00:00.000Z"),
        warehouseId: WAREHOUSE_A,
        referenceType: null,
        referenceId: null,
        narration: null,
      },
    ]);

    const result = await getStockLedger(COMPANY_ID, PRODUCT_A);

    expect(result.lines.map((line) => line.runningBalance)).toEqual([10, 6, 11]);
    expect(result.closingBalance).toBe(11);
  });
});

describe("getStockValuation", () => {
  it("values stock at the product's current purchasePrice (Latest Purchase Cost)", async () => {
    aggregateStockByProductMock.mockResolvedValue([
      { productId: PRODUCT_A, direction: "IN", quantity: 20 },
      { productId: PRODUCT_A, direction: "OUT", quantity: 5 },
    ]);
    findProductsForValuationMock.mockResolvedValue([{ id: PRODUCT_A, name: "Widget", purchasePrice: 100 }]);

    const result = await getStockValuation(COMPANY_ID);

    expect(result.rows).toEqual([
      { productId: PRODUCT_A, productName: "Widget", quantity: 15, unitCost: 100, value: 1500, isUnvalued: false },
    ]);
    expect(result.totalValue).toBe(1500);
  });

  it("flags a product with no purchasePrice as unvalued, at 0 value", async () => {
    aggregateStockByProductMock.mockResolvedValue([{ productId: PRODUCT_B, direction: "IN", quantity: 8 }]);
    findProductsForValuationMock.mockResolvedValue([{ id: PRODUCT_B, name: "Gadget", purchasePrice: null }]);

    const result = await getStockValuation(COMPANY_ID);

    expect(result.rows).toEqual([
      { productId: PRODUCT_B, productName: "Gadget", quantity: 8, unitCost: 0, value: 0, isUnvalued: true },
    ]);
    expect(result.totalValue).toBe(0);
  });

  it("passes the warehouse filter through to the aggregation", async () => {
    aggregateStockByProductMock.mockResolvedValue([]);
    findProductsForValuationMock.mockResolvedValue([]);

    await getStockValuation(COMPANY_ID, { warehouseId: WAREHOUSE_A });

    expect(aggregateStockByProductMock).toHaveBeenCalledWith(COMPANY_ID, WAREHOUSE_A);
  });
});

describe("AppError propagation", () => {
  it("rejection errors are instances of AppError", async () => {
    findProductsForMovementMock.mockResolvedValue([]);
    await expect(getStockLedger(COMPANY_ID, PRODUCT_A)).rejects.toBeInstanceOf(AppError);
  });
});
