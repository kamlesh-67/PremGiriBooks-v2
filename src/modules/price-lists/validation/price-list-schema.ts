import { z } from "zod";

import { CUSTOMER_TYPE_VALUES } from "@/modules/customers/validation/customer-schema";

const NAME_SCHEMA = z
  .string()
  .trim()
  .min(2, "Name must be at least 2 characters")
  .max(100, "Name must be at most 100 characters");

// Reuses 26-customer-management.md's exported tuple rather than redeclaring
// it — a tiered price list restricts to one of the same four customer tiers
// (29-price-lists.md's Data Model). Omitted entirely = tier-agnostic.
const CUSTOMER_TYPE_SCHEMA = z.enum(CUSTOMER_TYPE_VALUES, "Select a valid customer type").optional();

const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

// Same round-trip check as financial-year-schema.ts's isValidCalendarDate —
// `Date` silently rolls over out-of-range days/months (2026-02-30 becomes
// 2026-03-02) instead of rejecting them.
function isValidCalendarDate(value: string): boolean {
  if (!DATE_REGEX.test(value)) {
    return false;
  }
  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) {
    return false;
  }
  return date.toISOString().slice(0, 10) === value;
}

// Both effectiveFrom/effectiveTo are optional (unlike financial-year's
// required start/end) — a blank field normalizes to undefined so the header
// can be always-effective or one-sided (29-price-lists.md's Data Model).
const OPTIONAL_DATE_SCHEMA = z
  .string()
  .trim()
  .transform((value) => (value === "" ? undefined : value))
  .optional()
  .refine((value) => value === undefined || isValidCalendarDate(value), {
    message: "Enter a valid date",
  });

// A trimmed-blank description normalizes to undefined (toPersistData then
// stores it as null), matching every other master's description field.
const DESCRIPTION_SCHEMA = z
  .string()
  .trim()
  .max(500, "Description must be at most 500 characters")
  .transform((value) => (value === "" ? undefined : value))
  .optional();

export const createPriceListSchema = z
  .object({
    name: NAME_SCHEMA,
    customerType: CUSTOMER_TYPE_SCHEMA,
    effectiveFrom: OPTIONAL_DATE_SCHEMA,
    effectiveTo: OPTIONAL_DATE_SCHEMA,
    description: DESCRIPTION_SCHEMA,
  })
  .refine(
    (data) =>
      !data.effectiveFrom ||
      !data.effectiveTo ||
      !isValidCalendarDate(data.effectiveFrom) ||
      !isValidCalendarDate(data.effectiveTo) ||
      new Date(`${data.effectiveFrom}T00:00:00.000Z`) <=
        new Date(`${data.effectiveTo}T00:00:00.000Z`),
    { message: "Effective from date must be on or before the effective to date", path: ["effectiveTo"] }
  );

export type CreatePriceListInput = z.infer<typeof createPriceListSchema>;

// Create and Update share the same field set — every header field remains
// editable (29-price-lists.md's Business Rules has no immutability rule for
// the header). Kept as a separate named schema so a future spec can diverge
// them without touching callers, matching every other master's convention.
export const updatePriceListSchema = createPriceListSchema;

export type UpdatePriceListInput = z.infer<typeof updatePriceListSchema>;

// The server re-verifies company scope + active status for the product
// reference — this only guards the shape (25-product-management.md's "never
// trust client ids", applied here to the item row's product).
const PRODUCT_ID_SCHEMA = z.uuid("Select a product");

// Decimal(14,2)/Decimal(14,4) storage limits — same scaled-with-tolerance
// float check as gst-rate-schema.ts's hasAtMostTwoDecimals (18.15 * 100 ===
// 1814.9999… in binary floats).
const PRICE_MAX = 999_999_999_999.99;
const MIN_QUANTITY_MAX = 9_999_999_999.9999;

function hasAtMostDecimals(value: number, places: number): boolean {
  const factor = 10 ** places;
  return Math.abs(value * factor - Math.round(value * factor)) < 1e-6;
}

const SELLING_PRICE_SCHEMA = z
  .number("Selling price must be a number")
  .min(0, "Selling price must be 0 or more")
  .max(PRICE_MAX, "Selling price is too large")
  .refine((value) => hasAtMostDecimals(value, 2), {
    message: "Selling price can have at most 2 decimal places",
  });

// Optional at the boundary; the service normalizes an omitted value to 1
// (29-price-lists.md's Data Model default) — kept `.optional()` rather than
// `.default(1)` so the schema's input and output types stay identical, the
// same reasoning as gst-rate-schema.ts's CESS_PERCENT_SCHEMA (zodResolver's
// typing against useForm<T> requires it).
const MIN_QUANTITY_SCHEMA = z
  .number("Min quantity must be a number")
  .min(0.0001, "Min quantity must be at least 0.0001")
  .max(MIN_QUANTITY_MAX, "Min quantity is too large")
  .refine((value) => hasAtMostDecimals(value, 4), {
    message: "Min quantity can have at most 4 decimal places",
  })
  .optional();

export const priceListItemSchema = z.object({
  productId: PRODUCT_ID_SCHEMA,
  sellingPrice: SELLING_PRICE_SCHEMA,
  minQuantity: MIN_QUANTITY_SCHEMA,
});

export type PriceListItemInput = z.infer<typeof priceListItemSchema>;

// Add and Update item share the same field set — an item row's product,
// price, and min quantity all remain editable (29-price-lists.md's
// Features).
export const updatePriceListItemSchema = priceListItemSchema;

export type UpdatePriceListItemInput = z.infer<typeof updatePriceListItemSchema>;
