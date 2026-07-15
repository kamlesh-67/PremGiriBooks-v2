import { z } from "zod";

const NAME_SCHEMA = z
  .string()
  .trim()
  .min(2, "Name must be at least 2 characters")
  .max(100, "Name must be at most 100 characters");

// The DB column is Decimal(5,2) — two decimal places is a hard storage
// limit, not just a style rule (and the statutory 0.25% slab needs both).
// Checked against the value scaled to hundredths with a small tolerance
// because a legitimate 2-decimal input like 18.15 is not exactly
// representable in binary floating point (18.15 * 100 === 1814.9999…).
function hasAtMostTwoDecimals(value: number): boolean {
  return Math.abs(value * 100 - Math.round(value * 100)) < 1e-6;
}

const RATE_PERCENT_SCHEMA = z
  .number("Rate percent must be a number between 0 and 100")
  .min(0, "Rate percent must be between 0 and 100")
  .max(100, "Rate percent must be between 0 and 100")
  .refine(hasAtMostTwoDecimals, "Rate percent can have at most 2 decimal places");

// Optional at the boundary; toPersistData stores `undefined` as 0, matching
// how unit-schema.ts's optional fields normalize at the service edge. Kept
// `.optional()` rather than `.default(0)` so the schema's input and output
// types stay identical — zodResolver's typing against
// useForm<CreateGstRateInput> requires that, same reasoning as
// unit-schema.ts's UQC_CODE_SCHEMA comment.
const CESS_PERCENT_SCHEMA = z
  .number("Cess percent must be a number between 0 and 100")
  .min(0, "Cess percent must be between 0 and 100")
  .max(100, "Cess percent must be between 0 and 100")
  .refine(hasAtMostTwoDecimals, "Cess percent can have at most 2 decimal places")
  .optional();

// A trimmed-blank description normalizes to undefined (which toPersistData
// then stores as null), matching unit-schema.ts — without this, clearing the
// field on the edit form would persist "" instead of null.
const DESCRIPTION_SCHEMA = z
  .string()
  .trim()
  .max(500, "Description must be at most 500 characters")
  .transform((value) => (value === "" ? undefined : value))
  .optional();

export const createGstRateSchema = z.object({
  name: NAME_SCHEMA,
  ratePercent: RATE_PERCENT_SCHEMA,
  cessPercent: CESS_PERCENT_SCHEMA,
  description: DESCRIPTION_SCHEMA,
});

export type CreateGstRateInput = z.infer<typeof createGstRateSchema>;

// Create and Update share the same field set — every GstRate field remains
// editable while nothing references a rate (23-gst-rate-management.md: once
// transactional documents exist, posted lines snapshot the percentage at
// posting time, so editing this master never rewrites history). Kept as a
// separate named schema so a future spec can diverge them without touching
// callers.
export const updateGstRateSchema = createGstRateSchema;

export type UpdateGstRateInput = z.infer<typeof updateGstRateSchema>;
