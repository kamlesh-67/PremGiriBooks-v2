import { z } from "zod";

// Engines are system boundaries for their consumers even though they are
// not HTTP boundaries (30-pricing-engine.md's Validation convention). This
// engine additionally has no data access at all (33-gst-engine.md's
// Security: "Nothing here is company-scoped because nothing here touches
// storage") — every schema below validates shape and range only.

/** Mirrors voucher-validation.ts's/inventory-validation.ts's identical tolerance-based 2-decimal check — duplicated per-engine by this codebase's own convention rather than shared across engine boundaries. */
export function hasAtMostTwoDecimals(value: number): boolean {
  return Math.abs(value * 100 - Math.round(value * 100)) < 1e-6;
}

const MONEY_AMOUNT_SCHEMA = z
  .number("Amount must be a number")
  .finite("Amount must be finite")
  .positive("Amount must be greater than zero")
  .refine(hasAtMostTwoDecimals, "Amount can have at most 2 decimal places");

const PERCENT_SCHEMA = z
  .number("Percent must be a number")
  .finite("Percent must be finite")
  .min(0, "Percent must be between 0 and 100")
  .max(100, "Percent must be between 0 and 100")
  .refine(hasAtMostTwoDecimals, "Percent can have at most 2 decimal places");

const SUPPLY_TYPE_VALUES = ["INTRA_STATE", "INTER_STATE"] as const;
export type SupplyType = (typeof SUPPLY_TYPE_VALUES)[number];

export const calculateLineInputSchema = z.object({
  amount: MONEY_AMOUNT_SCHEMA,
  isInclusive: z.boolean(),
  ratePercent: PERCENT_SCHEMA,
  cessPercent: PERCENT_SCHEMA,
  supplyType: z.enum(SUPPLY_TYPE_VALUES, "Select a valid supply type"),
  // Kept `.optional()` rather than `.default(false)` (gst-rate-schema.ts's
  // CESS_PERCENT_SCHEMA convention) so the inferred input type keeps this
  // field optional for callers; calculateLine defaults it internally.
  isReverseCharge: z.boolean().optional(),
});

export type CalculateLineInput = z.infer<typeof calculateLineInputSchema>;

export interface CalculateLineResult {
  taxableAmount: number;
  cgst: number;
  sgst: number;
  igst: number;
  cess: number;
  totalTax: number;
  totalAmount: number;
  isReverseCharge: boolean;
}

export const calculateDocumentInputSchema = z
  .array(calculateLineInputSchema)
  .min(1, "At least one line is required");

export type CalculateDocumentInput = z.infer<typeof calculateDocumentInputSchema>;

/** Per-(ratePercent, cessPercent) aggregation group — two lines sharing a rate but carrying different cess stay separate groups (33-gst-engine.md's Document aggregation rule). */
export interface DocumentGroupResult {
  ratePercent: number;
  cessPercent: number;
  taxableAmount: number;
  cgst: number;
  sgst: number;
  igst: number;
  cess: number;
  totalTax: number;
}

export interface CalculateDocumentResult {
  groups: DocumentGroupResult[];
  taxableAmount: number;
  cgst: number;
  sgst: number;
  igst: number;
  cess: number;
  totalTax: number;
  totalAmount: number;
}
