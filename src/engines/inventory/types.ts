import type { StockDirection, StockTransactionType } from "@prisma/client";

export type { StockMovementLineInput, TransferStockInput } from "@/engines/inventory/inventory-validation";

// Decimal -> number normalized at the repository boundary (established
// convention) — this is the shape returned by every inventory-engine.ts
// method, never a raw Prisma row.
export interface RecordedStockTransaction {
  id: string;
  companyId: string;
  productId: string;
  warehouseId: string;
  transactionType: StockTransactionType;
  direction: StockDirection;
  quantity: number;
  unitCost: number | null;
  transactionDate: Date;
  referenceType: string | null;
  referenceId: string | null;
  transferGroupId: string | null;
  narration: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface TransferStockResult {
  outTransaction: RecordedStockTransaction;
  inTransaction: RecordedStockTransaction;
}

export interface CurrentStockFilters {
  productId?: string;
  warehouseId?: string;
}

/** One (product, warehouse) pair's net quantity (Sigma IN - Sigma OUT). Both the "single-pair" and "per-warehouse breakdown" shapes 32-inventory-engine.md describes are this same row, just filtered differently. */
export interface CurrentStockRow {
  productId: string;
  warehouseId: string;
  quantity: number;
}

export interface StockLedgerFilters {
  warehouseId?: string;
  from?: Date;
  to?: Date;
}

export interface StockLedgerLine {
  id: string;
  transactionType: StockTransactionType;
  direction: StockDirection;
  quantity: number;
  unitCost: number | null;
  transactionDate: Date;
  warehouseId: string;
  referenceType: string | null;
  referenceId: string | null;
  narration: string | null;
  /** Running balance immediately after this line (Sigma IN - Sigma OUT, up to and including this row). */
  runningBalance: number;
}

export interface StockLedgerResult {
  productId: string;
  lines: StockLedgerLine[];
  closingBalance: number;
}

export interface StockValuationFilters {
  warehouseId?: string;
}

export interface StockValuationRow {
  productId: string;
  productName: string;
  quantity: number;
  /** `product.purchasePrice`, or 0 when unset (see `isUnvalued`). */
  unitCost: number;
  value: number;
  /** True when `product.purchasePrice` is null — nothing to value from, flagged so reports can surface it (32-inventory-engine.md). */
  isUnvalued: boolean;
}

export interface StockValuationResult {
  rows: StockValuationRow[];
  totalValue: number;
}
