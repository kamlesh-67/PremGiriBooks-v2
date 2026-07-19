import { Prisma } from "@prisma/client";

import { AppError } from "@/lib/app-error";
import { isRetryableTransactionError } from "@/lib/prisma-errors";
import { runInTransaction } from "@/lib/transaction";
import {
  aggregateOutDemand,
  directionErrorMessage,
  hasSufficientStock,
  hasValidQuantityPrecision,
  isDirectionAllowed,
  isFutureTransactionDate,
  pairKey,
  recordMovementsInputSchema,
  toUtcDate,
  transferStockInputSchema,
  type StockMovementLineInput,
  type TransferStockInput,
} from "@/engines/inventory/inventory-validation";
import type { RecordedStockTransaction, TransferStockResult } from "@/engines/inventory/types";
import {
  stockTransactionRepository,
  type ProductForMovement,
  type WarehouseForMovement,
} from "@/modules/stock-transactions/repositories/stock-transaction-repository";

// The one-oversell-invariant guard (code-standards.md: "Negative stock
// depends on company settings") — the same recipe as
// financial-year-repository.ts's "only one current flag" and
// warehouse-repository.ts's "only one default": a read-then-write
// availability check must run under Serializable isolation with bounded
// P2034 retry, or two concurrent OUT movements against the same
// (product, warehouse) could both pass the same stale read.
const SERIALIZABLE_RETRY = {
  isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
  retryable: isRetryableTransactionError,
  conflictMessage: "Stock levels changed due to another request. Please try again.",
};

type PrismaClientOrTransaction = Parameters<typeof stockTransactionRepository.findProductsForMovement>[0];

/**
 * A referenced product must belong to the caller's company, be active, and
 * be a TRADING product — all "at movement time" (32-inventory-engine.md's
 * Business Rules; historical rows survive later deactivation untouched).
 */
function assertMovableProduct(
  product: ProductForMovement | undefined,
  companyId: string
): ProductForMovement {
  if (!product || product.companyId !== companyId) {
    throw new AppError("Product not found.");
  }
  if (!product.isActive) {
    throw new AppError(`Product "${product.name}" is inactive and cannot record stock movements.`);
  }
  if (product.productType !== "TRADING") {
    throw new AppError(`Product "${product.name}" is not a trading product and cannot carry stock.`);
  }
  return product;
}

/** A referenced warehouse must belong to the caller's company and be active at movement time. */
function assertActiveWarehouse(
  warehouse: WarehouseForMovement | undefined,
  companyId: string
): WarehouseForMovement {
  if (!warehouse || warehouse.companyId !== companyId) {
    throw new AppError("Warehouse not found.");
  }
  if (!warehouse.isActive) {
    throw new AppError(`Warehouse "${warehouse.name}" is inactive and cannot record stock movements.`);
  }
  return warehouse;
}

/** Mirrors product-repository.ts's assertMinStockLevelPrecision / pricing-engine.ts's assertQuantityPrecision. */
function assertQuantityPrecision(quantity: number, decimalPlaces: number): void {
  if (!hasValidQuantityPrecision(quantity, decimalPlaces)) {
    throw new AppError(
      decimalPlaces === 0
        ? "Quantity must be a whole number — the selected product's unit has 0 decimal places."
        : `Quantity can have at most ${decimalPlaces} decimal places — the selected product's unit's limit.`
    );
  }
}

/** Structural checks that need no database access — run before any repository call (mirrors voucher-engine.ts's balance check). */
function assertLinesWellFormed(lines: readonly StockMovementLineInput[], now: Date): void {
  for (const line of lines) {
    if (!isDirectionAllowed(line.transactionType, line.direction)) {
      throw new AppError(directionErrorMessage(line.transactionType));
    }
    if (isFutureTransactionDate(toUtcDate(line.transactionDate), now)) {
      throw new AppError("Transaction date cannot be in the future.");
    }
  }
}

async function loadProductsAndWarehouses(
  client: PrismaClientOrTransaction,
  productIds: readonly string[],
  warehouseIds: readonly string[]
): Promise<{ productById: Map<string, ProductForMovement>; warehouseById: Map<string, WarehouseForMovement> }> {
  const [products, warehouses] = await Promise.all([
    stockTransactionRepository.findProductsForMovement(client, productIds),
    stockTransactionRepository.findWarehousesForMovement(client, warehouseIds),
  ]);
  return {
    productById: new Map(products.map((product) => [product.id, product])),
    warehouseById: new Map(warehouses.map((warehouse) => [warehouse.id, warehouse])),
  };
}

/**
 * Validates every line's product/warehouse references and quantity
 * precision, validates aggregated OUT demand against current stock (unless
 * `allowNegativeStock` is set), then inserts. Always runs on the caller's
 * transaction — `recordMovements` decides above whether that transaction is
 * Serializable.
 */
async function recordMovementsInTransaction(
  tx: Prisma.TransactionClient,
  companyId: string,
  lines: readonly StockMovementLineInput[]
): Promise<RecordedStockTransaction[]> {
  const productIds = [...new Set(lines.map((line) => line.productId))];
  const warehouseIds = [...new Set(lines.map((line) => line.warehouseId))];
  const { productById, warehouseById } = await loadProductsAndWarehouses(tx, productIds, warehouseIds);

  for (const line of lines) {
    const product = assertMovableProduct(productById.get(line.productId), companyId);
    assertQuantityPrecision(line.quantity, product.unit.decimalPlaces);
    assertActiveWarehouse(warehouseById.get(line.warehouseId), companyId);
  }

  const demand = aggregateOutDemand(lines);
  if (demand.length > 0) {
    const allowNegativeStock = await stockTransactionRepository.findAllowNegativeStock(companyId);
    if (!allowNegativeStock) {
      const currentStockByPair = await stockTransactionRepository.sumStockForPairs(tx, companyId, demand);
      for (const item of demand) {
        const currentStock = currentStockByPair.get(pairKey(item.productId, item.warehouseId)) ?? 0;
        if (!hasSufficientStock(currentStock, item.quantity)) {
          const product = productById.get(item.productId);
          throw new AppError(
            `Insufficient stock for "${product?.name ?? item.productId}" at the selected warehouse.`
          );
        }
      }
    }
  }

  return stockTransactionRepository.createMany(tx, companyId, lines);
}

/**
 * The batch API documents use (one document = many lines, atomically, on
 * the caller's transaction — the spec-31 `tx` pass-through convention, so
 * invoice + voucher + stock post as one transaction).
 *
 * Isolation contract for the passed `tx`: this engine cannot upgrade the
 * isolation level of, or retry, a transaction it does not own. When
 * `rawLines` contains any OUT line, the caller must have opened the outer
 * transaction at Serializable isolation and must own the bounded P2034
 * retry of the ENTIRE posting transaction (the shared `runInTransaction` +
 * a Serializable-retry options object exist for exactly this — mirror the
 * `SERIALIZABLE_RETRY` constant above). Only when no `tx` is supplied does
 * this function open and retry its own Serializable transaction, per the
 * OUT rule below. IN-only batches need no Serializable isolation, whether
 * `tx` is supplied or not.
 */
export async function recordMovements(
  companyId: string,
  rawLines: unknown,
  tx?: Prisma.TransactionClient
): Promise<RecordedStockTransaction[]> {
  const lines = recordMovementsInputSchema.parse(rawLines);
  assertLinesWellFormed(lines, new Date());

  if (tx) {
    return recordMovementsInTransaction(tx, companyId, lines);
  }

  const needsSerializable = lines.some((line) => line.direction === "OUT");
  if (needsSerializable) {
    return runInTransaction((innerTx) => recordMovementsInTransaction(innerTx, companyId, lines), SERIALIZABLE_RETRY);
  }
  return runInTransaction((innerTx) => recordMovementsInTransaction(innerTx, companyId, lines));
}

/** Single-line convenience wrapper over `recordMovements`. */
export async function recordMovement(
  companyId: string,
  rawLine: unknown,
  tx?: Prisma.TransactionClient
): Promise<RecordedStockTransaction> {
  const [result] = await recordMovements(companyId, [rawLine], tx);
  return result;
}

async function transferStockInTransaction(
  tx: Prisma.TransactionClient,
  companyId: string,
  input: TransferStockInput
): Promise<TransferStockResult> {
  const { productById, warehouseById } = await loadProductsAndWarehouses(
    tx,
    [input.productId],
    [input.sourceWarehouseId, input.destinationWarehouseId]
  );

  const product = assertMovableProduct(productById.get(input.productId), companyId);
  assertQuantityPrecision(input.quantity, product.unit.decimalPlaces);
  assertActiveWarehouse(warehouseById.get(input.sourceWarehouseId), companyId);
  assertActiveWarehouse(warehouseById.get(input.destinationWarehouseId), companyId);

  const allowNegativeStock = await stockTransactionRepository.findAllowNegativeStock(companyId);
  if (!allowNegativeStock) {
    const currentStockByPair = await stockTransactionRepository.sumStockForPairs(tx, companyId, [
      { productId: input.productId, warehouseId: input.sourceWarehouseId },
    ]);
    const currentStock = currentStockByPair.get(pairKey(input.productId, input.sourceWarehouseId)) ?? 0;
    if (!hasSufficientStock(currentStock, input.quantity)) {
      throw new AppError(`Insufficient stock for "${product.name}" at the source warehouse.`);
    }
  }

  return stockTransactionRepository.createTransferPair(tx, companyId, {
    productId: input.productId,
    sourceWarehouseId: input.sourceWarehouseId,
    destinationWarehouseId: input.destinationWarehouseId,
    quantity: input.quantity,
    transactionDate: toUtcDate(input.transactionDate),
    narration: input.narration ?? null,
  });
}

/**
 * Writes the OUT row (source warehouse) and IN row (destination) with one
 * `transferGroupId`, atomically. Source and destination must differ
 * (schema-enforced); availability is validated on the OUT side only, unless
 * `allowNegativeStock` is set. Always Serializable + bounded retry when this
 * function owns the transaction, for the same reason as `recordMovements`'s
 * OUT path — see that function's isolation-contract note when passing `tx`.
 */
export async function transferStock(
  companyId: string,
  rawInput: unknown,
  tx?: Prisma.TransactionClient
): Promise<TransferStockResult> {
  const input = transferStockInputSchema.parse(rawInput);
  if (isFutureTransactionDate(toUtcDate(input.transactionDate), new Date())) {
    throw new AppError("Transaction date cannot be in the future.");
  }

  if (tx) {
    return transferStockInTransaction(tx, companyId, input);
  }
  return runInTransaction((innerTx) => transferStockInTransaction(innerTx, companyId, input), SERIALIZABLE_RETRY);
}

export const inventoryEngine = {
  recordMovement,
  recordMovements,
  transferStock,
};
