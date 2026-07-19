import { describe, expect, it, vi, beforeEach } from "vitest";

const findManyMock = vi.fn();

const txPriceListFindUniqueMock = vi.fn();
const txPriceListUpdateMock = vi.fn();
const txProductFindUniqueMock = vi.fn();
const txItemCreateMock = vi.fn();
const txItemUpdateMock = vi.fn();
const txItemFindUniqueMock = vi.fn();
const txItemDeleteMock = vi.fn();

const txMock = {
  priceList: {
    findUnique: (...args: unknown[]) => txPriceListFindUniqueMock(...args),
    update: (...args: unknown[]) => txPriceListUpdateMock(...args),
  },
  product: {
    findUnique: (...args: unknown[]) => txProductFindUniqueMock(...args),
  },
  priceListItem: {
    create: (...args: unknown[]) => txItemCreateMock(...args),
    update: (...args: unknown[]) => txItemUpdateMock(...args),
    findUnique: (...args: unknown[]) => txItemFindUniqueMock(...args),
    delete: (...args: unknown[]) => txItemDeleteMock(...args),
  },
};

// Mirrors src/lib/transaction.test.ts's convention — mock the Prisma client
// boundary rather than hitting a real database from a unit test.
// runInTransaction calls prisma.$transaction(fn), so the mock just invokes
// the callback with a fake transaction client exposing the same sub-mocks.
vi.mock("@/lib/prisma", () => ({
  prisma: {
    priceList: { findMany: (...args: unknown[]) => findManyMock(...args) },
    $transaction: (fn: (tx: typeof txMock) => unknown) => fn(txMock),
  },
}));

import { priceListRepository } from "@/modules/price-lists/repositories/price-list-repository";

const COMPANY_ID = "company-1";
const OTHER_COMPANY_ID = "company-2";

function decimal(value: number) {
  return { toNumber: () => value };
}

function baseRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "list-1",
    companyId: COMPANY_ID,
    name: "Standard",
    customerType: null,
    effectiveFrom: null,
    effectiveTo: null,
    description: null,
    isActive: true,
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    items: [],
    ...overrides,
  };
}

describe("priceListRepository.findEffectiveLists", () => {
  beforeEach(() => {
    findManyMock.mockReset();
  });

  it("filters to active lists for the given company with no extra criteria", async () => {
    findManyMock.mockResolvedValueOnce([]);

    await priceListRepository.findEffectiveLists(COMPANY_ID);

    expect(findManyMock).toHaveBeenCalledWith(
      expect.objectContaining({ where: { companyId: COMPANY_ID, isActive: true } })
    );
  });

  it("adds a tier filter matching tier-agnostic lists or the given tier", async () => {
    findManyMock.mockResolvedValueOnce([]);

    await priceListRepository.findEffectiveLists(COMPANY_ID, { customerType: "WHOLESALE" });

    const { where } = findManyMock.mock.calls[0][0];
    expect(where.OR).toEqual([{ customerType: null }, { customerType: "WHOLESALE" }]);
  });

  it("omits the tier filter when no customerType criterion is given", async () => {
    findManyMock.mockResolvedValueOnce([]);

    await priceListRepository.findEffectiveLists(COMPANY_ID, {});

    const { where } = findManyMock.mock.calls[0][0];
    expect(where.OR).toBeUndefined();
  });

  it("adds a date-window filter covering one-sided and always-effective lists", async () => {
    findManyMock.mockResolvedValueOnce([]);
    const date = new Date("2026-07-19T00:00:00.000Z");

    await priceListRepository.findEffectiveLists(COMPANY_ID, { effectiveDate: date });

    const { where } = findManyMock.mock.calls[0][0];
    expect(where.AND).toEqual([
      { OR: [{ effectiveFrom: null }, { effectiveFrom: { lte: date } }] },
      { OR: [{ effectiveTo: null }, { effectiveTo: { gte: date } }] },
    ]);
  });

  it("combines the tier filter and the date-window filter when both are given", async () => {
    findManyMock.mockResolvedValueOnce([]);
    const date = new Date("2026-07-19T00:00:00.000Z");

    await priceListRepository.findEffectiveLists(COMPANY_ID, {
      customerType: "DEALER",
      effectiveDate: date,
    });

    const { where } = findManyMock.mock.calls[0][0];
    expect(where.OR).toEqual([{ customerType: null }, { customerType: "DEALER" }]);
    expect(where.AND).toEqual([
      { OR: [{ effectiveFrom: null }, { effectiveFrom: { lte: date } }] },
      { OR: [{ effectiveTo: null }, { effectiveTo: { gte: date } }] },
    ]);
  });

  it("normalizes item Decimal fields to plain numbers", async () => {
    findManyMock.mockResolvedValueOnce([
      baseRow({
        items: [
          {
            id: "item-1",
            priceListId: "list-1",
            productId: "product-1",
            sellingPrice: decimal(150.5),
            minQuantity: decimal(10),
            createdAt: new Date("2026-01-01T00:00:00.000Z"),
            updatedAt: new Date("2026-01-01T00:00:00.000Z"),
          },
        ],
      }),
    ]);

    const [result] = await priceListRepository.findEffectiveLists(COMPANY_ID);

    expect(result.items[0].sellingPrice).toBe(150.5);
    expect(result.items[0].minQuantity).toBe(10);
  });
});

const VALID_LIST_ROW = {
  id: "list-1",
  companyId: COMPANY_ID,
  isActive: true,
};

const ACTIVE_PRODUCT_ROW = {
  id: "product-1",
  companyId: COMPANY_ID,
  isActive: true,
};

function resetTxMocks() {
  txPriceListFindUniqueMock.mockReset();
  txPriceListUpdateMock.mockReset();
  txProductFindUniqueMock.mockReset();
  txItemCreateMock.mockReset();
  txItemUpdateMock.mockReset();
  txItemFindUniqueMock.mockReset();
  txItemDeleteMock.mockReset();
}

describe("priceListRepository.addItem", () => {
  beforeEach(resetTxMocks);

  it("returns not_found when the list belongs to a different company (tenant isolation)", async () => {
    txPriceListFindUniqueMock.mockResolvedValueOnce({ ...VALID_LIST_ROW, companyId: OTHER_COMPANY_ID });

    const result = await priceListRepository.addItem("list-1", COMPANY_ID, {
      productId: "product-1",
      sellingPrice: 100,
      minQuantity: 1,
    });

    expect(result).toEqual({ status: "not_found" });
    expect(txProductFindUniqueMock).not.toHaveBeenCalled();
  });

  it("returns not_found when the list does not exist", async () => {
    txPriceListFindUniqueMock.mockResolvedValueOnce(null);

    const result = await priceListRepository.addItem("missing-list", COMPANY_ID, {
      productId: "product-1",
      sellingPrice: 100,
      minQuantity: 1,
    });

    expect(result).toEqual({ status: "not_found" });
  });

  it("throws when the product belongs to a different company", async () => {
    txPriceListFindUniqueMock.mockResolvedValueOnce(VALID_LIST_ROW);
    txProductFindUniqueMock.mockResolvedValueOnce({ ...ACTIVE_PRODUCT_ROW, companyId: OTHER_COMPANY_ID });

    await expect(
      priceListRepository.addItem("list-1", COMPANY_ID, {
        productId: "product-1",
        sellingPrice: 100,
        minQuantity: 1,
      })
    ).rejects.toThrow("Selected product was not found.");
  });

  it("throws when the product is inactive", async () => {
    txPriceListFindUniqueMock.mockResolvedValueOnce(VALID_LIST_ROW);
    txProductFindUniqueMock.mockResolvedValueOnce({ ...ACTIVE_PRODUCT_ROW, isActive: false });

    await expect(
      priceListRepository.addItem("list-1", COMPANY_ID, {
        productId: "product-1",
        sellingPrice: 100,
        minQuantity: 1,
      })
    ).rejects.toThrow("Selected product is inactive.");
  });

  it("creates the item when the list and product are both valid", async () => {
    txPriceListFindUniqueMock.mockResolvedValueOnce(VALID_LIST_ROW);
    txProductFindUniqueMock.mockResolvedValueOnce(ACTIVE_PRODUCT_ROW);
    txItemCreateMock.mockResolvedValueOnce({
      id: "item-1",
      priceListId: "list-1",
      productId: "product-1",
      sellingPrice: decimal(100),
      minQuantity: decimal(1),
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      updatedAt: new Date("2026-01-01T00:00:00.000Z"),
      product: { id: "product-1", name: "Widget", productCode: "WID-1", isActive: true },
    });

    const result = await priceListRepository.addItem("list-1", COMPANY_ID, {
      productId: "product-1",
      sellingPrice: 100,
      minQuantity: 1,
    });

    expect(result.status).toBe("ok");
    expect(txItemCreateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { priceListId: "list-1", productId: "product-1", sellingPrice: 100, minQuantity: 1 },
      })
    );
  });
});

describe("priceListRepository.updateItem", () => {
  beforeEach(resetTxMocks);

  it("returns not_found when the list belongs to a different company (tenant isolation)", async () => {
    txPriceListFindUniqueMock.mockResolvedValueOnce({ ...VALID_LIST_ROW, companyId: OTHER_COMPANY_ID });

    const result = await priceListRepository.updateItem("list-1", "item-1", COMPANY_ID, {
      productId: "product-1",
      sellingPrice: 100,
      minQuantity: 1,
    });

    expect(result).toEqual({ status: "not_found" });
  });

  it("returns not_found when the item does not belong to this list", async () => {
    txPriceListFindUniqueMock.mockResolvedValueOnce(VALID_LIST_ROW);
    txItemFindUniqueMock.mockResolvedValueOnce({ id: "item-1", priceListId: "another-list" });

    const result = await priceListRepository.updateItem("list-1", "item-1", COMPANY_ID, {
      productId: "product-1",
      sellingPrice: 100,
      minQuantity: 1,
    });

    expect(result).toEqual({ status: "not_found" });
  });

  it("does not re-verify the product when it is unchanged, even if since deactivated", async () => {
    txPriceListFindUniqueMock.mockResolvedValueOnce(VALID_LIST_ROW);
    txItemFindUniqueMock.mockResolvedValueOnce({
      id: "item-1",
      priceListId: "list-1",
      productId: "product-1",
    });
    txItemUpdateMock.mockResolvedValueOnce({
      id: "item-1",
      priceListId: "list-1",
      productId: "product-1",
      sellingPrice: decimal(150),
      minQuantity: decimal(1),
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      updatedAt: new Date("2026-01-01T00:00:00.000Z"),
      product: { id: "product-1", name: "Widget", productCode: "WID-1", isActive: false },
    });

    const result = await priceListRepository.updateItem("list-1", "item-1", COMPANY_ID, {
      productId: "product-1",
      sellingPrice: 150,
      minQuantity: 1,
    });

    expect(result.status).toBe("ok");
    expect(txProductFindUniqueMock).not.toHaveBeenCalled();
  });

  it("re-verifies and rejects an inactive product when the product changed", async () => {
    txPriceListFindUniqueMock.mockResolvedValueOnce(VALID_LIST_ROW);
    txItemFindUniqueMock.mockResolvedValueOnce({
      id: "item-1",
      priceListId: "list-1",
      productId: "product-1",
    });
    txProductFindUniqueMock.mockResolvedValueOnce({ ...ACTIVE_PRODUCT_ROW, id: "product-2", isActive: false });

    await expect(
      priceListRepository.updateItem("list-1", "item-1", COMPANY_ID, {
        productId: "product-2",
        sellingPrice: 150,
        minQuantity: 1,
      })
    ).rejects.toThrow("Selected product is inactive.");
  });
});

describe("priceListRepository.removeItem", () => {
  beforeEach(resetTxMocks);

  it("returns not_found when the list belongs to a different company (tenant isolation)", async () => {
    txPriceListFindUniqueMock.mockResolvedValueOnce({ ...VALID_LIST_ROW, companyId: OTHER_COMPANY_ID });

    const result = await priceListRepository.removeItem("list-1", "item-1", COMPANY_ID);

    expect(result).toEqual({ status: "not_found" });
    expect(txItemDeleteMock).not.toHaveBeenCalled();
  });

  it("returns not_found when the item does not belong to this list", async () => {
    txPriceListFindUniqueMock.mockResolvedValueOnce(VALID_LIST_ROW);
    txItemFindUniqueMock.mockResolvedValueOnce({ id: "item-1", priceListId: "another-list" });

    const result = await priceListRepository.removeItem("list-1", "item-1", COMPANY_ID);

    expect(result).toEqual({ status: "not_found" });
    expect(txItemDeleteMock).not.toHaveBeenCalled();
  });

  it("deletes the item when the list and item are both valid", async () => {
    txPriceListFindUniqueMock.mockResolvedValueOnce(VALID_LIST_ROW);
    txItemFindUniqueMock.mockResolvedValueOnce({ id: "item-1", priceListId: "list-1" });

    const result = await priceListRepository.removeItem("list-1", "item-1", COMPANY_ID);

    expect(result).toEqual({ status: "ok" });
    expect(txItemDeleteMock).toHaveBeenCalledWith({ where: { id: "item-1" } });
  });
});

describe("priceListRepository.activate / deactivate", () => {
  beforeEach(resetTxMocks);

  it("activate returns not_found for a cross-company list", async () => {
    txPriceListFindUniqueMock.mockResolvedValueOnce({ ...VALID_LIST_ROW, companyId: OTHER_COMPANY_ID });

    const result = await priceListRepository.activate("list-1", COMPANY_ID);

    expect(result).toEqual({ status: "not_found" });
    expect(txPriceListUpdateMock).not.toHaveBeenCalled();
  });

  it("deactivate returns not_found for a cross-company list", async () => {
    txPriceListFindUniqueMock.mockResolvedValueOnce({ ...VALID_LIST_ROW, companyId: OTHER_COMPANY_ID });

    const result = await priceListRepository.deactivate("list-1", COMPANY_ID);

    expect(result).toEqual({ status: "not_found" });
    expect(txPriceListUpdateMock).not.toHaveBeenCalled();
  });

  it("activate updates isActive to true for a same-company list", async () => {
    txPriceListFindUniqueMock.mockResolvedValueOnce(VALID_LIST_ROW);
    txPriceListUpdateMock.mockResolvedValueOnce({ ...VALID_LIST_ROW, isActive: true });

    const result = await priceListRepository.activate("list-1", COMPANY_ID);

    expect(result.status).toBe("ok");
    expect(txPriceListUpdateMock).toHaveBeenCalledWith({
      where: { id: "list-1" },
      data: { isActive: true },
    });
  });
});
