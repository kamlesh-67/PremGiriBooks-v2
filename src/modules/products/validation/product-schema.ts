import { z } from "zod";

const NAME_SCHEMA = z
  .string()
  .trim()
  .min(2, "Name must be at least 2 characters")
  .max(200, "Name must be at most 200 characters");

// Required user-entered SKU, unique per company. No auto-numbering — the
// Document Number Engine (#32) doesn't exist yet, and a one-off generator
// here would be superseded by it (25-product-management.md).
const PRODUCT_CODE_SCHEMA = z
  .string()
  .trim()
  .min(2, "Product code must be at least 2 characters")
  .max(50, "Product code must be at most 50 characters");

// Optional EAN/UPC or self-printed barcode; blank normalizes to undefined so
// clearing the field persists NULL — and NULLs are exempt from the
// per-company uniqueness rule (Postgres treats them as distinct), so many
// products may omit it.
const BARCODE_SCHEMA = z
  .string()
  .trim()
  .transform((value) => (value === "" ? undefined : value))
  .optional()
  .refine((value) => value === undefined || value.length >= 4, {
    message: "Barcode must be at least 4 characters",
  })
  .refine((value) => value === undefined || value.length <= 50, {
    message: "Barcode must be at most 50 characters",
  });

// FORMULA is deliberately absent — reserved for the future manufacturing
// release (25-product-management.md's Do Not).
export const PRODUCT_TYPE_VALUES = ["TRADING", "SERVICE", "EXPENSE"] as const;

const PRODUCT_TYPE_SCHEMA = z.enum(PRODUCT_TYPE_VALUES, "Select a product type");

// The server re-verifies company scope + active status for every reference
// (and the HSN-vs-SAC type match) — these only guard the shape
// (25-product-management.md's "never trust client ids").
const UNIT_ID_SCHEMA = z.uuid("Select a unit");

const OPTIONAL_REFERENCE_SCHEMA = (label: string) =>
  z.uuid(`Select a valid ${label}`).optional();

// The DB columns are Decimal(14,2) — two decimal places and the 10^12 whole
// range are hard storage limits. Same scaled-with-tolerance check as
// gst-rate-schema.ts's hasAtMostTwoDecimals (binary floats make 18.15 * 100
// land at 1814.9999…).
const PRICE_MAX = 999_999_999_999.99;

function hasAtMostDecimals(value: number, places: number): boolean {
  const factor = 10 ** places;
  return Math.abs(value * factor - Math.round(value * factor)) < 1e-6;
}

const PRICE_SCHEMA = (label: string) =>
  z
    .number(`${label} must be a number`)
    .min(0, `${label} must be 0 or more`)
    .max(PRICE_MAX, `${label} is too large`)
    .refine((value) => hasAtMostDecimals(value, 2), {
      message: `${label} can have at most 2 decimal places`,
    })
    .optional();

// Decimal(14,4) storage limit — 4 decimal places max here; the tighter rule
// (no more decimals than the selected unit's decimalPlaces) is unit-dependent
// and enforced at the service/repository boundary inside the write
// transaction, where the unit row is read (25-product-management.md).
const MIN_STOCK_LEVEL_SCHEMA = z
  .number("Min stock level must be a number")
  .min(0, "Min stock level must be 0 or more")
  .max(9_999_999_999.9999, "Min stock level is too large")
  .refine((value) => hasAtMostDecimals(value, 4), {
    message: "Min stock level can have at most 4 decimal places",
  })
  .optional();

// A trimmed-blank description normalizes to undefined (which toPersistData
// then stores as null), matching the description fields across the masters.
const DESCRIPTION_SCHEMA = z
  .string()
  .trim()
  .max(1000, "Description must be at most 1000 characters")
  .transform((value) => (value === "" ? undefined : value))
  .optional();

export const createProductSchema = z.object({
  name: NAME_SCHEMA,
  productCode: PRODUCT_CODE_SCHEMA,
  barcode: BARCODE_SCHEMA,
  productType: PRODUCT_TYPE_SCHEMA,
  categoryId: OPTIONAL_REFERENCE_SCHEMA("category"),
  brandId: OPTIONAL_REFERENCE_SCHEMA("brand"),
  unitId: UNIT_ID_SCHEMA,
  hsnCodeId: OPTIONAL_REFERENCE_SCHEMA("HSN/SAC code"),
  gstRateId: OPTIONAL_REFERENCE_SCHEMA("GST rate"),
  defaultWarehouseId: OPTIONAL_REFERENCE_SCHEMA("warehouse"),
  marginProfileId: OPTIONAL_REFERENCE_SCHEMA("margin profile"),
  mrp: PRICE_SCHEMA("MRP"),
  sellingPrice: PRICE_SCHEMA("Selling price"),
  purchasePrice: PRICE_SCHEMA("Purchase price"),
  minStockLevel: MIN_STOCK_LEVEL_SCHEMA,
  description: DESCRIPTION_SCHEMA,
});

export type CreateProductInput = z.infer<typeof createProductSchema>;

// Create and Update accept the same field set — every Product field remains
// editable while no stock exists (25-product-management.md; once the
// Inventory Engine #30 records movements, unitId and productType must become
// immutable). Kept as a separate named schema so that future spec can
// diverge them without touching callers.
export const updateProductSchema = createProductSchema;

export type UpdateProductInput = z.infer<typeof updateProductSchema>;
