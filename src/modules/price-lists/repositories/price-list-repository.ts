import type { CustomerType, Prisma } from "@prisma/client";

import { AppError } from "@/lib/app-error";
import { prisma } from "@/lib/prisma";
import { runInTransaction } from "@/lib/transaction";
import { isRecordNotFoundError } from "@/lib/prisma-errors";
import type {
  ActivatePriceListResult,
  AddPriceListItemResult,
  DeactivatePriceListResult,
  EffectivePriceList,
  EffectivePriceListCriteria,
  PriceListDetail,
  PriceListItem,
  PriceListItemWithProduct,
  PriceListListFilters,
  PriceListWithItemCount,
  RemovePriceListItemResult,
  UpdatePriceListItemResult,
} from "@/types/price-list";

export interface PriceListPersistData {
  name: string;
  customerType: CustomerType | null;
  effectiveFrom: Date | null;
  effectiveTo: Date | null;
  description: string | null;
}

export interface PriceListItemPersistData {
  productId: string;
  sellingPrice: number;
  minQuantity: number;
}

const ITEM_PRODUCT_SELECT = {
  id: true,
  name: true,
  productCode: true,
  isActive: true,
} as const;

const ITEM_INCLUDE = { product: { select: ITEM_PRODUCT_SELECT } } as const;

type PriceListItemRow = Prisma.PriceListItemGetPayload<{ include: typeof ITEM_INCLUDE }>;
type PriceListItemPlainRow = Prisma.PriceListItemGetPayload<Record<string, never>>;

// The Decimal columns (sellingPrice, minQuantity) are decimal.js instances at
// the database boundary — never serializable across a Server Component prop
// or a Server Action return value, so every read is normalized to plain
// numbers here, before it can reach a Client Component (mirrors
// margin-profile-repository.ts's toMarginProfile).
function toPriceListItem(raw: PriceListItemPlainRow): PriceListItem {
  return {
    ...raw,
    sellingPrice: raw.sellingPrice.toNumber(),
    minQuantity: raw.minQuantity.toNumber(),
  };
}

function toPriceListItemWithProduct(raw: PriceListItemRow): PriceListItemWithProduct {
  return {
    ...raw,
    sellingPrice: raw.sellingPrice.toNumber(),
    minQuantity: raw.minQuantity.toNumber(),
  };
}

// Matches the persistence-side normalization (price-list-service.ts's
// toDate(), and financial-year-schema.ts's identical convention) — a caller
// passing a `Date` with a real time-of-day (e.g. `new Date()`) must not
// under/over-match against the `@db.Date` columns, which are always stored
// at UTC midnight.
function toUtcMidnight(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function buildWhere(
  companyId: string,
  filters: PriceListListFilters
): Prisma.PriceListWhereInput {
  const where: Prisma.PriceListWhereInput = { companyId };

  if (filters.status === "active") {
    where.isActive = true;
  } else if (filters.status === "inactive") {
    where.isActive = false;
  }

  if (filters.search) {
    where.name = { contains: filters.search, mode: "insensitive" };
  }

  return where;
}

export const priceListRepository = {
  async findMany(
    companyId: string,
    filters: PriceListListFilters = {}
  ): Promise<PriceListWithItemCount[]> {
    const rows = await prisma.priceList.findMany({
      where: buildWhere(companyId, filters),
      include: { _count: { select: { items: true } } },
      orderBy: { name: "asc" },
    });
    return rows.map(({ _count, ...header }) => ({ ...header, itemCount: _count.items }));
  },

  async findById(id: string): Promise<PriceListDetail | null> {
    const row = await prisma.priceList.findUnique({
      where: { id },
      include: {
        items: { include: ITEM_INCLUDE, orderBy: [{ product: { name: "asc" } }, { minQuantity: "asc" }] },
      },
    });
    if (!row) {
      return null;
    }
    const { items, ...header } = row;
    return { ...header, items: items.map(toPriceListItemWithProduct) };
  },

  async create(companyId: string, data: PriceListPersistData): Promise<PriceListDetail> {
    const row = await prisma.priceList.create({
      data: { ...data, companyId },
      include: { items: { include: ITEM_INCLUDE } },
    });
    const { items, ...header } = row;
    return { ...header, items: items.map(toPriceListItemWithProduct) };
  },

  // Company-scoping is checked in the same transaction as the write,
  // mirroring margin-profile-repository.ts's update(). No invariant to guard
  // on the header itself — every field remains editable.
  async update(
    id: string,
    companyId: string,
    data: PriceListPersistData
  ): Promise<PriceListDetail | null> {
    return runInTransaction(async (tx) => {
      const existing = await tx.priceList.findUnique({ where: { id } });
      if (!existing || existing.companyId !== companyId) {
        return null;
      }

      try {
        const row = await tx.priceList.update({
          where: { id },
          data,
          include: { items: { include: ITEM_INCLUDE } },
        });
        const { items, ...header } = row;
        return { ...header, items: items.map(toPriceListItemWithProduct) };
      } catch (error) {
        if (isRecordNotFoundError(error)) {
          return null;
        }
        throw error;
      }
    });
  },

  async activate(id: string, companyId: string): Promise<ActivatePriceListResult> {
    return runInTransaction(async (tx) => {
      const existing = await tx.priceList.findUnique({ where: { id } });
      if (!existing || existing.companyId !== companyId) {
        return { status: "not_found" };
      }

      const row = await tx.priceList.update({ where: { id }, data: { isActive: true } });
      return { status: "ok", priceList: row };
    });
  },

  // Deactivation has no invariant to guard — the Pricing Engine simply skips
  // inactive lists; items are retained untouched (29-price-lists.md's
  // Business Rules), mirroring margin-profile-repository.ts's deactivate().
  async deactivate(id: string, companyId: string): Promise<DeactivatePriceListResult> {
    return runInTransaction(async (tx) => {
      const existing = await tx.priceList.findUnique({ where: { id } });
      if (!existing || existing.companyId !== companyId) {
        return { status: "not_found" };
      }

      const row = await tx.priceList.update({ where: { id }, data: { isActive: false } });
      return { status: "ok", priceList: row };
    });
  },

  // Item writes always run company-scoped through the parent: read-check-
  // write in one transaction, re-verifying the list belongs to the active
  // company before touching a row (29-price-lists.md's Business Rules). The
  // product reference is verified (company scope + active) whenever it is
  // newly assigned — same "at assignment time" rule as
  // product-repository.ts's verifyReferences.
  async addItem(
    listId: string,
    companyId: string,
    data: PriceListItemPersistData
  ): Promise<AddPriceListItemResult> {
    return runInTransaction(async (tx) => {
      const list = await tx.priceList.findUnique({ where: { id: listId } });
      if (!list || list.companyId !== companyId) {
        return { status: "not_found" };
      }

      const product = await tx.product.findUnique({ where: { id: data.productId } });
      if (!product || product.companyId !== companyId) {
        throw new AppError("Selected product was not found.");
      }
      if (!product.isActive) {
        throw new AppError("Selected product is inactive.");
      }

      const row = await tx.priceListItem.create({
        data: {
          priceListId: listId,
          productId: data.productId,
          sellingPrice: data.sellingPrice,
          minQuantity: data.minQuantity,
        },
        include: ITEM_INCLUDE,
      });
      return { status: "ok", item: toPriceListItemWithProduct(row) };
    });
  },

  // Re-verifies the product reference only when it changed — an unchanged,
  // since-deactivated product must not block editing the row's price or
  // minQuantity (25-product-management.md's "at assignment time" rule,
  // applied here per 29-price-lists.md's Business Rules).
  async updateItem(
    listId: string,
    itemId: string,
    companyId: string,
    data: PriceListItemPersistData
  ): Promise<UpdatePriceListItemResult> {
    return runInTransaction(async (tx) => {
      const list = await tx.priceList.findUnique({ where: { id: listId } });
      if (!list || list.companyId !== companyId) {
        return { status: "not_found" };
      }

      const existingItem = await tx.priceListItem.findUnique({ where: { id: itemId } });
      if (!existingItem || existingItem.priceListId !== listId) {
        return { status: "not_found" };
      }

      if (data.productId !== existingItem.productId) {
        const product = await tx.product.findUnique({ where: { id: data.productId } });
        if (!product || product.companyId !== companyId) {
          throw new AppError("Selected product was not found.");
        }
        if (!product.isActive) {
          throw new AppError("Selected product is inactive.");
        }
      }

      try {
        const row = await tx.priceListItem.update({
          where: { id: itemId },
          data: {
            productId: data.productId,
            sellingPrice: data.sellingPrice,
            minQuantity: data.minQuantity,
          },
          include: ITEM_INCLUDE,
        });
        return { status: "ok", item: toPriceListItemWithProduct(row) };
      } catch (error) {
        if (isRecordNotFoundError(error)) {
          return { status: "not_found" };
        }
        throw error;
      }
    });
  },

  // The documented hard-delete exception (29-price-lists.md's Do Not /
  // Business Rules) — an item row is a detail line, not a business record
  // with history; nothing references it.
  async removeItem(
    listId: string,
    itemId: string,
    companyId: string
  ): Promise<RemovePriceListItemResult> {
    return runInTransaction(async (tx) => {
      const list = await tx.priceList.findUnique({ where: { id: listId } });
      if (!list || list.companyId !== companyId) {
        return { status: "not_found" };
      }

      const existingItem = await tx.priceListItem.findUnique({ where: { id: itemId } });
      if (!existingItem || existingItem.priceListId !== listId) {
        return { status: "not_found" };
      }

      await tx.priceListItem.delete({ where: { id: itemId } });
      return { status: "ok" };
    });
  },

  /**
   * Active lists with their items, optionally filtered by customer tier
   * and/or an effective date — the read primitive the Pricing Engine (#28)
   * will consume (29-price-lists.md's Service/Repository). Selecting which
   * list/row wins is exclusively the Pricing Engine's job; this only
   * narrows to lists that are ACTIVE and, when a date is given, whose window
   * (if any) covers that calendar day.
   */
  async findEffectiveLists(
    companyId: string,
    criteria: EffectivePriceListCriteria = {}
  ): Promise<EffectivePriceList[]> {
    const where: Prisma.PriceListWhereInput = { companyId, isActive: true };

    if (criteria.customerType) {
      where.OR = [{ customerType: null }, { customerType: criteria.customerType }];
    }

    if (criteria.effectiveDate) {
      const effectiveDate = toUtcMidnight(criteria.effectiveDate);
      where.AND = [
        { OR: [{ effectiveFrom: null }, { effectiveFrom: { lte: effectiveDate } }] },
        { OR: [{ effectiveTo: null }, { effectiveTo: { gte: effectiveDate } }] },
      ];
    }

    const rows = await prisma.priceList.findMany({
      where,
      include: { items: true },
      orderBy: { name: "asc" },
    });

    return rows.map(({ items, ...header }) => ({ ...header, items: items.map(toPriceListItem) }));
  },
};
