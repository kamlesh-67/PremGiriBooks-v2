import { z } from "zod";

// Plain string-literal tuple (not the @prisma/client enum object) so the
// client-side form can import this module without pulling the Prisma runtime
// into the browser bundle — the HSN_CODE_TYPES/PRODUCT_TYPE_VALUES
// convention. Type-compatible with Prisma's PriceCalculationMode union.
export const PRICE_CALCULATION_MODES = ["MARGIN", "MARKUP"] as const;

const NAME_SCHEMA = z
  .string()
  .trim()
  .min(2, "Name must be at least 2 characters")
  .max(100, "Name must be at most 100 characters");

const CALCULATION_MODE_SCHEMA = z.enum(
  PRICE_CALCULATION_MODES,
  "Select a calculation mode"
);

// MARGIN divides by (1 − percent / 100), so a percent at or above 100 would
// divide by zero or go negative — bounded below 100. MARKUP has no such
// constraint; it is bounded only by the Decimal(5,2) storage limit
// (28-margin-profiles.md's Data Model). Exported so the form can derive its
// input `max` hint from the same bounds instead of duplicating the literals.
export const MARGIN_MAX_PERCENT = 100;
export const MARKUP_MAX_PERCENT = 999.99;

// The DB columns are Decimal(5,2) — two decimal places is a hard storage
// limit. Same scaled-with-tolerance check as gst-rate-schema.ts's
// hasAtMostTwoDecimals (18.15 * 100 === 1814.9999… in binary floats).
function hasAtMostTwoDecimals(value: number): boolean {
  return Math.abs(value * 100 - Math.round(value * 100)) < 1e-6;
}

function percentSchema(label: string) {
  return z
    .number(`${label} must be a number`)
    .min(0, `${label} must be 0 or more`)
    .max(MARKUP_MAX_PERCENT, `${label} is too large`)
    .refine(hasAtMostTwoDecimals, `${label} can have at most 2 decimal places`);
}

const RETAIL_PERCENT_SCHEMA = percentSchema("Retail percent");
const WHOLESALE_PERCENT_SCHEMA = percentSchema("Wholesale percent");
const DEALER_PERCENT_SCHEMA = percentSchema("Dealer percent");
const DISTRIBUTOR_PERCENT_SCHEMA = percentSchema("Distributor percent");

// A trimmed-blank description normalizes to undefined (which toPersistData
// then stores as null), matching gst-rate-schema.ts.
const DESCRIPTION_SCHEMA = z
  .string()
  .trim()
  .max(500, "Description must be at most 500 characters")
  .transform((value) => (value === "" ? undefined : value))
  .optional();

// The single source of truth for the four tier fields' name+label pairing —
// shared by the superRefine below, the margin profile form's inputs, and the
// margin profile table's columns, so all three stay in sync (rather than
// each re-listing the four tiers independently).
export const MARGIN_PROFILE_TIER_FIELDS = [
  { name: "retailPercent", label: "Retail %" },
  { name: "wholesalePercent", label: "Wholesale %" },
  { name: "dealerPercent", label: "Dealer %" },
  { name: "distributorPercent", label: "Distributor %" },
] as const;

// The valid percent range depends on the calculation mode (MARGIN: < 100,
// MARKUP: ≤ 999.99), so the tighter MARGIN bound lives in an object-level
// superRefine rather than on each field schema — the hsn-code-schema.ts
// shape (28-margin-profiles.md's Validation). Zod only runs the refinement
// once every field parses, so an out-of-range or non-2-decimal value
// surfaces its own field message alone.
export const createMarginProfileSchema = z
  .object({
    name: NAME_SCHEMA,
    calculationMode: CALCULATION_MODE_SCHEMA,
    retailPercent: RETAIL_PERCENT_SCHEMA,
    wholesalePercent: WHOLESALE_PERCENT_SCHEMA,
    dealerPercent: DEALER_PERCENT_SCHEMA,
    distributorPercent: DISTRIBUTOR_PERCENT_SCHEMA,
    description: DESCRIPTION_SCHEMA,
  })
  .superRefine((data, ctx) => {
    if (data.calculationMode !== "MARGIN") {
      return;
    }
    for (const { name, label } of MARGIN_PROFILE_TIER_FIELDS) {
      if (data[name] >= MARGIN_MAX_PERCENT) {
        ctx.addIssue({
          code: "custom",
          path: [name],
          message: `${label} must be less than 100 in Margin mode`,
        });
      }
    }
  });

export type CreateMarginProfileInput = z.infer<typeof createMarginProfileSchema>;

// Create and Update share the same field set — changing a profile's
// percentages or mode takes effect only the next time the Pricing Engine
// computes a price, since nothing is denormalized onto products
// (28-margin-profiles.md's Business Rules). Kept as a separate named schema
// so a future spec can diverge them without touching callers.
export const updateMarginProfileSchema = createMarginProfileSchema;

export type UpdateMarginProfileInput = z.infer<typeof updateMarginProfileSchema>;
