import { z } from "zod";
import type { StockDirection, StockTransactionType } from "@prisma/client";

// Pure validation core for the Inventory Engine — no I/O, no Prisma client,
// no session lookups (30-pricing-engine.md's Structure convention, reused by
// 31-voucher-engine.md and here: "engines may import from modules; modules
// never re-implement engine logic"). Everything here is fully unit-testable
// without mocking the database.

// Mirrors voucher-validation.ts's identical calendar-date convention — a
// plain YYYY-MM-DD string, round-tripped to reject dates like 2026-02-30
// that `Date` would otherwise silently roll over.
const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

export function isValidCalendarDate(value: string): boolean {
  if (!DATE_REGEX.test(value)) {
    return false;
  }
  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) {
    return false;
  }
  return date.toISOString().slice(0, 10) === value;
}

/** `YYYY-MM-DD` -> UTC-midnight `Date`, the storage shape for `transactionDate` (`@db.Date`). */
export function toUtcDate(value: string): Date {
  return new Date(`${value}T00:00:00.000Z`);
}

function toUtcMidnight(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

/** True when `transactionDate` falls after `now`'s UTC calendar day — "stock that hasn't happened yet doesn't exist" (32-inventory-engine.md's Business Rules). */
export function isFutureTransactionDate(transactionDate: Date, now: Date): boolean {
  return transactionDate.getTime() > toUtcMidnight(now).getTime();
}

/** True when `amount` has at most 2 decimal places (mirrors voucher-validation.ts's hasAtMostTwoDecimals). */
export function hasAtMostTwoDecimals(amount: number): boolean {
  return Math.abs(amount * 100 - Math.round(amount * 100)) < 1e-6;
}

/**
 * Quantity must honor the product unit's `decimalPlaces` (0-4) — the same
 * scaled-tolerance check as product-repository.ts's
 * assertMinStockLevelPrecision / pricing-engine.ts's assertQuantityPrecision.
 */
export function hasValidQuantityPrecision(quantity: number, decimalPlaces: number): boolean {
  const factor = 10 ** decimalPlaces;
  return Math.abs(quantity * factor - Math.round(quantity * factor)) < 1e-6;
}

/**
 * Every `transactionType` constrains its `direction`
 * (32-inventory-engine.md's Business Rules). `TRANSFER` maps to no allowed
 * direction here deliberately — a TRANSFER row may ONLY be written by
 * `transferStock`'s own paired insert; a line submitted through
 * `recordMovement`/`recordMovements` with `transactionType: "TRANSFER"` is
 * always "a lone TRANSFER row" and is always rejected by this matrix.
 */
const DIRECTION_RULES: Record<StockTransactionType, readonly StockDirection[]> = {
  OPENING_STOCK: ["IN"],
  PURCHASE: ["IN"],
  PURCHASE_RETURN: ["OUT"],
  SALES: ["OUT"],
  SALES_RETURN: ["IN"],
  TRANSFER: [],
  ADJUSTMENT: ["IN", "OUT"],
  PHYSICAL_VERIFICATION: ["IN", "OUT"],
};

export function isDirectionAllowed(transactionType: StockTransactionType, direction: StockDirection): boolean {
  return DIRECTION_RULES[transactionType].includes(direction);
}

export function directionErrorMessage(transactionType: StockTransactionType): string {
  if (transactionType === "TRANSFER") {
    return "TRANSFER movements can only be recorded through transferStock, not submitted directly.";
  }
  return `${transactionType} movements must be ${DIRECTION_RULES[transactionType].join(" or ")}.`;
}

/**
 * `currentStock - outQuantity >= 0`, tolerant of the float drift Decimal ->
 * number normalization can introduce (same epsilon as the precision checks
 * above) — the negative-stock gate (code-standards.md: "Negative stock
 * depends on company settings").
 */
export function hasSufficientStock(currentStock: number, outQuantity: number): boolean {
  return currentStock - outQuantity >= -1e-6;
}

/** Stable key for a (product, warehouse) pair — used to correlate aggregated demand against current-stock reads. */
export function pairKey(productId: string, warehouseId: string): string {
  return `${productId}::${warehouseId}`;
}

export interface AggregatedDemand {
  productId: string;
  warehouseId: string;
  quantity: number;
}

interface DemandLine {
  productId: string;
  warehouseId: string;
  direction: StockDirection;
  quantity: number;
}

/**
 * Sums OUT quantities per (product, warehouse) pair across a batch — batch
 * availability is validated on this aggregated demand, not per line (three
 * lines of 4 units each must not individually pass against a stock of 10).
 * IN lines are NOT netted against OUT lines in the same batch (conservative
 * by design — a batch must not depend on its own inflows to cover its
 * outflows).
 */
export function aggregateOutDemand(lines: readonly DemandLine[]): AggregatedDemand[] {
  const byKey = new Map<string, AggregatedDemand>();
  for (const line of lines) {
    if (line.direction !== "OUT") {
      continue;
    }
    const key = pairKey(line.productId, line.warehouseId);
    const existing = byKey.get(key);
    if (existing) {
      existing.quantity += line.quantity;
    } else {
      byKey.set(key, { productId: line.productId, warehouseId: line.warehouseId, quantity: line.quantity });
    }
  }
  return [...byKey.values()];
}

// Zod schemas -------------------------------------------------------------

const STOCK_TRANSACTION_TYPE_VALUES = [
  "OPENING_STOCK",
  "PURCHASE",
  "PURCHASE_RETURN",
  "SALES",
  "SALES_RETURN",
  "TRANSFER",
  "ADJUSTMENT",
  "PHYSICAL_VERIFICATION",
] as const;

const STOCK_DIRECTION_VALUES = ["IN", "OUT"] as const;

// Engines are system boundaries for their consumers even though they are not
// HTTP boundaries (30-pricing-engine.md's Validation convention) —
// `companyId` is taken as an explicit parameter by every engine function
// (the spec-31 convention), never part of this schema; every loaded row is
// still re-verified against it inside inventory-engine.ts (defense in
// depth, the standing engine convention).
export const stockMovementLineSchema = z
  .object({
    productId: z.uuid("Select a valid product"),
    warehouseId: z.uuid("Select a valid warehouse"),
    transactionType: z.enum(STOCK_TRANSACTION_TYPE_VALUES, "Select a valid transaction type"),
    direction: z.enum(STOCK_DIRECTION_VALUES, "Select a valid direction"),
    quantity: z.number("Quantity must be a number").positive("Quantity must be greater than zero"),
    unitCost: z
      .number("Unit cost must be a number")
      .nonnegative("Unit cost cannot be negative")
      .refine(hasAtMostTwoDecimals, "Unit cost can have at most 2 decimal places")
      .optional(),
    transactionDate: z.string().trim().refine(isValidCalendarDate, "Enter a valid transaction date"),
    referenceType: z.string().trim().max(50, "Reference type must be at most 50 characters").optional(),
    referenceId: z.uuid("Reference id must be a valid id").optional(),
    narration: z.string().trim().max(500, "Narration must be at most 500 characters").optional(),
  })
  .refine((data) => Boolean(data.referenceType) === Boolean(data.referenceId), {
    message: "referenceType and referenceId must both be provided together, or both omitted",
    path: ["referenceId"],
  });

export const recordMovementsInputSchema = z
  .array(stockMovementLineSchema)
  .min(1, "At least one movement line is required");

export const transferStockInputSchema = z
  .object({
    productId: z.uuid("Select a valid product"),
    sourceWarehouseId: z.uuid("Select a valid source warehouse"),
    destinationWarehouseId: z.uuid("Select a valid destination warehouse"),
    quantity: z.number("Quantity must be a number").positive("Quantity must be greater than zero"),
    transactionDate: z.string().trim().refine(isValidCalendarDate, "Enter a valid transaction date"),
    narration: z.string().trim().max(500, "Narration must be at most 500 characters").optional(),
  })
  .refine((data) => data.sourceWarehouseId !== data.destinationWarehouseId, {
    message: "Source and destination warehouse must be different",
    path: ["destinationWarehouseId"],
  });

export type StockMovementLineInput = z.infer<typeof stockMovementLineSchema>;
export type TransferStockInput = z.infer<typeof transferStockInputSchema>;
