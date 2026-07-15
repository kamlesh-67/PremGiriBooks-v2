import { z } from "zod";

const NAME_SCHEMA = z
  .string()
  .trim()
  .min(2, "Name must be at least 2 characters")
  .max(100, "Name must be at most 100 characters");

const SYMBOL_SCHEMA = z
  .string()
  .trim()
  .min(1, "Symbol is required")
  .max(10, "Symbol must be at most 10 characters");

// Optional GST Unit Quantity Code ("PCS", "KGS", "MTR", …). A blank input
// normalizes to undefined; anything else is trimmed, uppercased, and must be
// 2–10 letters. Deliberately not validated against the official UQC list —
// the GST Engine (phase-tracker #31) owns that decision (19-unit-management.md).
// Implemented as refine + transform (not z.preprocess) so the schema's input
// type stays `string | undefined` — z.preprocess widens the input to
// `unknown`, which breaks zodResolver's typing against useForm<CreateUnitInput>.
const UQC_CODE_SCHEMA = z
  .string()
  .trim()
  .toUpperCase()
  .refine((value) => value === "" || /^[A-Z]{2,10}$/.test(value), {
    message: "UQC code must be 2-10 letters (A-Z)",
  })
  .transform((value) => (value === "" ? undefined : value))
  .optional();

const DECIMAL_PLACES_SCHEMA = z
  .number("Decimal places must be a number between 0 and 4")
  .int("Decimal places must be a whole number")
  .min(0, "Decimal places must be between 0 and 4")
  .max(4, "Decimal places must be between 0 and 4");

// A trimmed-blank description normalizes to undefined (which toPersistData
// then stores as null), matching UQC_CODE_SCHEMA — without this, clearing
// the field on the edit form would persist "" instead of null.
const DESCRIPTION_SCHEMA = z
  .string()
  .trim()
  .max(500, "Description must be at most 500 characters")
  .transform((value) => (value === "" ? undefined : value))
  .optional();

export const createUnitSchema = z.object({
  name: NAME_SCHEMA,
  symbol: SYMBOL_SCHEMA,
  uqcCode: UQC_CODE_SCHEMA,
  decimalPlaces: DECIMAL_PLACES_SCHEMA,
  description: DESCRIPTION_SCHEMA,
});

export type CreateUnitInput = z.infer<typeof createUnitSchema>;

// Create and Update share the same field set — every Unit field remains
// editable (19-unit-management.md: no dependents exist until Product
// Management, and nothing financial references a Unit). Kept as a separate
// named schema so a future spec can diverge them without touching callers.
export const updateUnitSchema = createUnitSchema;

export type UpdateUnitInput = z.infer<typeof updateUnitSchema>;
