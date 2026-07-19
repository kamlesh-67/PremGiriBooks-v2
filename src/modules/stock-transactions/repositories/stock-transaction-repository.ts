import { randomUUID } from "node:crypto";

import { Prisma, type ProductType, type StockDirection } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { pairKey } from "@/engines/inventory/inventory-validation";
import type {
  CurrentStockFilters,
  CurrentStockRow,
  RecordedStockTransaction,
  StockLedgerFilters,
  StockMovementLineInput,
  TransferStockResult,
} from "@/engines/inventory/types";

type PrismaClientOrTransaction = typeof prisma | Prisma.TransactionClient;

export interface ProductForMovement {
  id: string;
  companyId: string;
  name: string;
  isActive: boolean;
  productType: ProductType;
  unit: { decimalPlaces: number };
}

export interface WarehouseForMovement {
  id: string;
  companyId: string;
  name: string;
  isActive: boolean;
}

export interface ProductForValuation {
  id: string;
  name: string;
  purchasePrice: number | null;
}

// Decimal -> number normalization at the repository boundary (established
// convention, e.g. voucher-repository.ts's toPostedVoucher).
function toRecordedStockTransaction(raw: {
  id: string;
  companyId: string;
  productId: string;
  warehouseId: string;
  transactionType: RecordedStockTransaction["transactionType"];
  direction: StockDirection;
  quantity: Prisma.Decimal;
  unitCost: Prisma.Decimal | null;
  transactionDate: Date;
  referenceType: string | null;
  referenceId: string | null;
  transferGroupId: string | null;
  narration: string | null;
  createdAt: Date;
  updatedAt: Date;
}): RecordedStockTransaction {
  return {
    id: raw.id,
    companyId: raw.companyId,
    productId: raw.productId,
    warehouseId: raw.warehouseId,
    transactionType: raw.transactionType,
    direction: raw.direction,
    quantity: raw.quantity.toNumber(),
    unitCost: raw.unitCost === null ? null : raw.unitCost.toNumber(),
    transactionDate: raw.transactionDate,
    referenceType: raw.referenceType,
    referenceId: raw.referenceId,
    transferGroupId: raw.transferGroupId,
    narration: raw.narration,
    createdAt: raw.createdAt,
    updatedAt: raw.updatedAt,
  };
}

function toDecimalSum(sum: Prisma.Decimal | null): number {
  return (sum ?? new Prisma.Decimal(0)).toNumber();
}

export const stockTransactionRepository = {
  /** Batch lookup for the product/type/active checks recordMovements and transferStock each enforce. */
  async findProductsForMovement(
    client: PrismaClientOrTransaction,
    productIds: readonly string[]
  ): Promise<ProductForMovement[]> {
    return client.product.findMany({
      where: { id: { in: [...productIds] } },
      select: {
        id: true,
        companyId: true,
        name: true,
        isActive: true,
        productType: true,
        unit: { select: { decimalPlaces: true } },
      },
    });
  },

  /** Batch lookup for the warehouse company-scope/active checks. */
  async findWarehousesForMovement(
    client: PrismaClientOrTransaction,
    warehouseIds: readonly string[]
  ): Promise<WarehouseForMovement[]> {
    return client.warehouse.findMany({
      where: { id: { in: [...warehouseIds] } },
      select: { id: true, companyId: true, name: true, isActive: true },
    });
  },

  /** The negative-stock gate (code-standards.md). Defaults to `false` if the company's settings row is somehow missing — the safer default. */
  async findAllowNegativeStock(companyId: string): Promise<boolean> {
    const settings = await prisma.companySettings.findUnique({
      where: { companyId },
      select: { allowNegativeStock: true },
    });
    return settings?.allowNegativeStock ?? false;
  },

  /**
   * Current stock (Sigma IN - Sigma OUT) for exactly the requested (product,
   * warehouse) pairs, keyed by `pairKey` — the availability-check read.
   * Always run on the caller's transaction so it observes the same
   * Serializable snapshot as the insert that follows it. Pairs with no
   * transaction history at all are not present in Postgres's `groupBy`
   * output but ARE included in the returned map at 0, so callers never have
   * to special-case "no history yet."
   */
  async sumStockForPairs(
    tx: Prisma.TransactionClient,
    companyId: string,
    pairs: readonly { productId: string; warehouseId: string }[]
  ): Promise<Map<string, number>> {
    const result = new Map<string, number>();
    for (const pair of pairs) {
      result.set(pairKey(pair.productId, pair.warehouseId), 0);
    }
    if (pairs.length === 0) {
      return result;
    }

    const rows = await tx.stockTransaction.groupBy({
      by: ["productId", "warehouseId", "direction"],
      where: {
        companyId,
        OR: pairs.map((pair) => ({ productId: pair.productId, warehouseId: pair.warehouseId })),
      },
      _sum: { quantity: true },
    });

    for (const row of rows) {
      const key = pairKey(row.productId, row.warehouseId);
      const signedQuantity = row.direction === "IN" ? toDecimalSum(row._sum.quantity) : -toDecimalSum(row._sum.quantity);
      result.set(key, (result.get(key) ?? 0) + signedQuantity);
    }

    return result;
  },

  /**
   * Bulk-inserts every line atomically, always on the caller's transaction
   * (inventory-engine.ts never calls this outside one). Postgres's
   * multi-row `INSERT ... VALUES (...), (...) RETURNING` preserves the
   * VALUES list order, so the result array lines up with `lines`.
   */
  async createMany(
    tx: Prisma.TransactionClient,
    companyId: string,
    lines: readonly StockMovementLineInput[]
  ): Promise<RecordedStockTransaction[]> {
    const created = await tx.stockTransaction.createManyAndReturn({
      data: lines.map((line) => ({
        companyId,
        productId: line.productId,
        warehouseId: line.warehouseId,
        transactionType: line.transactionType,
        direction: line.direction,
        quantity: line.quantity,
        unitCost: line.unitCost ?? null,
        transactionDate: new Date(`${line.transactionDate}T00:00:00.000Z`),
        referenceType: line.referenceType ?? null,
        referenceId: line.referenceId ?? null,
        narration: line.narration ?? null,
      })),
    });
    return created.map(toRecordedStockTransaction);
  },

  /**
   * Writes the OUT row (source) and IN row (destination) sharing one
   * generated `transferGroupId`, atomically on the caller's transaction —
   * a transfer is exactly two linked rows, `unitCost` null on both
   * (32-inventory-engine.md's Data Model decisions).
   */
  async createTransferPair(
    tx: Prisma.TransactionClient,
    companyId: string,
    input: {
      productId: string;
      sourceWarehouseId: string;
      destinationWarehouseId: string;
      quantity: number;
      transactionDate: Date;
      narration: string | null;
    }
  ): Promise<TransferStockResult> {
    const transferGroupId = randomUUID();

    const [outRow, inRow] = await Promise.all([
      tx.stockTransaction.create({
        data: {
          companyId,
          productId: input.productId,
          warehouseId: input.sourceWarehouseId,
          transactionType: "TRANSFER",
          direction: "OUT",
          quantity: input.quantity,
          unitCost: null,
          transactionDate: input.transactionDate,
          transferGroupId,
          narration: input.narration,
        },
      }),
      tx.stockTransaction.create({
        data: {
          companyId,
          productId: input.productId,
          warehouseId: input.destinationWarehouseId,
          transactionType: "TRANSFER",
          direction: "IN",
          quantity: input.quantity,
          unitCost: null,
          transactionDate: input.transactionDate,
          transferGroupId,
          narration: input.narration,
        },
      }),
    ]);

    return {
      outTransaction: toRecordedStockTransaction(outRow),
      inTransaction: toRecordedStockTransaction(inRow),
    };
  },

  /**
   * Current stock rows for `getCurrentStock` — grouped Sigma IN - Sigma OUT,
   * optionally narrowed to one product and/or one warehouse. Both the
   * "single-pair" (both filters given) and "per-warehouse breakdown" (only
   * `productId` given) shapes 32-inventory-engine.md describes are this
   * same array, just filtered differently.
   */
  async aggregateCurrentStock(companyId: string, filters: CurrentStockFilters = {}): Promise<CurrentStockRow[]> {
    const rows = await prisma.stockTransaction.groupBy({
      by: ["productId", "warehouseId", "direction"],
      where: {
        companyId,
        ...(filters.productId ? { productId: filters.productId } : {}),
        ...(filters.warehouseId ? { warehouseId: filters.warehouseId } : {}),
      },
      _sum: { quantity: true },
    });

    const byPair = new Map<string, CurrentStockRow>();
    for (const row of rows) {
      const key = pairKey(row.productId, row.warehouseId);
      const signedQuantity = row.direction === "IN" ? toDecimalSum(row._sum.quantity) : -toDecimalSum(row._sum.quantity);
      const existing = byPair.get(key);
      if (existing) {
        existing.quantity += signedQuantity;
      } else {
        byPair.set(key, { productId: row.productId, warehouseId: row.warehouseId, quantity: signedQuantity });
      }
    }
    return [...byPair.values()];
  },

  /** Per-product Sigma IN - Sigma OUT across all warehouses, or within one when `warehouseId` is given — the getStockValuation aggregation. */
  async aggregateStockByProduct(
    companyId: string,
    warehouseId?: string
  ): Promise<{ productId: string; direction: StockDirection; quantity: number }[]> {
    const rows = await prisma.stockTransaction.groupBy({
      by: ["productId", "direction"],
      where: { companyId, ...(warehouseId ? { warehouseId } : {}) },
      _sum: { quantity: true },
    });
    return rows.map((row) => ({
      productId: row.productId,
      direction: row.direction,
      quantity: toDecimalSum(row._sum.quantity),
    }));
  },

  /** Name + Latest Purchase Cost for the products a valuation run needs to price. */
  async findProductsForValuation(companyId: string, productIds: readonly string[]): Promise<ProductForValuation[]> {
    const rows = await prisma.product.findMany({
      where: { companyId, id: { in: [...productIds] } },
      select: { id: true, name: true, purchasePrice: true },
    });
    return rows.map((row) => ({
      id: row.id,
      name: row.name,
      purchasePrice: row.purchasePrice === null ? null : row.purchasePrice.toNumber(),
    }));
  },

  /** Dated movements for one product — the stock-register primitive `getStockLedger` walks to build a running balance. */
  async findLedgerTransactions(
    companyId: string,
    productId: string,
    filters: StockLedgerFilters = {}
  ): Promise<RecordedStockTransaction[]> {
    const rows = await prisma.stockTransaction.findMany({
      where: {
        companyId,
        productId,
        ...(filters.warehouseId ? { warehouseId: filters.warehouseId } : {}),
        ...(filters.from || filters.to
          ? {
              transactionDate: {
                ...(filters.from ? { gte: filters.from } : {}),
                ...(filters.to ? { lte: filters.to } : {}),
              },
            }
          : {}),
      },
      orderBy: [{ transactionDate: "asc" }, { createdAt: "asc" }],
    });
    return rows.map(toRecordedStockTransaction);
  },
};
