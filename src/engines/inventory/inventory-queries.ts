import { AppError } from "@/lib/app-error";
import { prisma } from "@/lib/prisma";
import { stockTransactionRepository } from "@/modules/stock-transactions/repositories/stock-transaction-repository";
import type {
  CurrentStockFilters,
  CurrentStockRow,
  StockLedgerFilters,
  StockLedgerLine,
  StockLedgerResult,
  StockValuationFilters,
  StockValuationResult,
  StockValuationRow,
} from "@/engines/inventory/types";

// Half-up rounding at the storage precision (2dp for money, 4dp for
// quantity) for display-ready totals — the same convention voucher-queries.ts
// and price-resolution.ts each use for their own rounded results.
function round(value: number, decimalPlaces: number): number {
  const factor = 10 ** decimalPlaces;
  return Math.round((value + Number.EPSILON) * factor) / factor;
}

async function assertProductBelongsToCompany(companyId: string, productId: string): Promise<void> {
  const [product] = await stockTransactionRepository.findProductsForMovement(prisma, [productId]);
  if (!product || product.companyId !== companyId) {
    throw new AppError("Product not found.");
  }
}

/**
 * Current stock (Sigma IN - Sigma OUT), grouped by (product, warehouse).
 * Passing both `productId` and `warehouseId` narrows to a single pair;
 * passing only `productId` returns its per-warehouse breakdown
 * (32-inventory-engine.md's Structure). Deliberately does not validate that
 * `productId`/`warehouseId` exist — an unknown id simply yields no rows
 * (matches Prisma `groupBy`'s natural behavior; no repository row to
 * company-scope-check against here since nothing is loaded by primary key).
 */
export async function getCurrentStock(
  companyId: string,
  filters: CurrentStockFilters = {}
): Promise<CurrentStockRow[]> {
  return stockTransactionRepository.aggregateCurrentStock(companyId, filters);
}

/**
 * Dated movements for one product with a running balance — the stock
 * register primitive (Inventory Reports #67 renders it). `companyId` is
 * verified against the product before any transaction read (a cross-company
 * productId resolves as not-found, never leaking existence — the standing
 * engine convention).
 */
export async function getStockLedger(
  companyId: string,
  productId: string,
  filters: StockLedgerFilters = {}
): Promise<StockLedgerResult> {
  await assertProductBelongsToCompany(companyId, productId);

  const transactions = await stockTransactionRepository.findLedgerTransactions(companyId, productId, filters);

  let running = 0;
  const lines: StockLedgerLine[] = transactions.map((transaction) => {
    running = round(running + (transaction.direction === "IN" ? transaction.quantity : -transaction.quantity), 4);
    return {
      id: transaction.id,
      transactionType: transaction.transactionType,
      direction: transaction.direction,
      quantity: transaction.quantity,
      unitCost: transaction.unitCost,
      transactionDate: transaction.transactionDate,
      warehouseId: transaction.warehouseId,
      referenceType: transaction.referenceType,
      referenceId: transaction.referenceId,
      narration: transaction.narration,
      runningBalance: running,
    };
  });

  return { productId, lines, closingBalance: running };
}

/**
 * Per-product quantity x Latest Purchase Cost (`Product.purchasePrice`) —
 * the current costing strategy (architecture-context.md Costing Strategy).
 * A product with no `purchasePrice` values at 0 and is flagged `isUnvalued`
 * so reports can surface it, rather than silently under-valuing stock.
 * Only products with any recorded movement appear (only TRADING products
 * ever carry a transaction, so this list is already naturally scoped).
 */
export async function getStockValuation(
  companyId: string,
  filters: StockValuationFilters = {}
): Promise<StockValuationResult> {
  const stockByProduct = await stockTransactionRepository.aggregateStockByProduct(companyId, filters.warehouseId);

  const quantityByProductId = new Map<string, number>();
  for (const entry of stockByProduct) {
    const signedQuantity = entry.direction === "IN" ? entry.quantity : -entry.quantity;
    quantityByProductId.set(entry.productId, (quantityByProductId.get(entry.productId) ?? 0) + signedQuantity);
  }

  const productIds = [...quantityByProductId.keys()];
  const products = await stockTransactionRepository.findProductsForValuation(companyId, productIds);
  const productById = new Map(products.map((product) => [product.id, product]));

  const rows: StockValuationRow[] = [];
  let totalValue = 0;
  for (const [productId, rawQuantity] of quantityByProductId) {
    const product = productById.get(productId);
    if (!product) {
      // Defensive only — no code path hard-deletes a Product, so a
      // movement's productId always resolves.
      continue;
    }
    const quantity = round(rawQuantity, 4);
    const isUnvalued = product.purchasePrice === null;
    const unitCost = product.purchasePrice ?? 0;
    const value = round(quantity * unitCost, 2);
    rows.push({ productId, productName: product.name, quantity, unitCost, value, isUnvalued });
    totalValue += value;
  }

  return { rows, totalValue: round(totalValue, 2) };
}

export const inventoryQueries = {
  getCurrentStock,
  getStockLedger,
  getStockValuation,
};
