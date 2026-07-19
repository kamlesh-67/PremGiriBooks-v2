import { describe, expect, it, vi, beforeEach } from "vitest";

const findManyMock = vi.fn();

// Mirrors src/lib/transaction.test.ts's convention — mock the Prisma client
// boundary and assert on the `where` clause built for it, rather than
// hitting a real database from a unit test.
vi.mock("@/lib/prisma", () => ({
  prisma: {
    priceList: { findMany: (...args: unknown[]) => findManyMock(...args) },
  },
}));

import { priceListRepository } from "@/modules/price-lists/repositories/price-list-repository";

const COMPANY_ID = "company-1";

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
