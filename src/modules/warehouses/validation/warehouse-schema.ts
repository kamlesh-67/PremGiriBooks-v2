import { z } from "zod";

const NAME_SCHEMA = z
  .string()
  .trim()
  .min(2, "Name must be at least 2 characters")
  .max(100, "Name must be at most 100 characters");

// Short identifier printed on stock documents (e.g. "WH-MAIN"), unique per
// company independently of name — mirrors Branch.branchCode and Unit's
// name/symbol pairing (24-warehouse-management.md).
const CODE_SCHEMA = z
  .string()
  .trim()
  .min(2, "Code must be at least 2 characters")
  .max(20, "Code must be at most 20 characters");

// The server re-verifies company scope and active status for the branch —
// this only guards the shape (24-warehouse-management.md's "never trust the
// client").
const BRANCH_ID_SCHEMA = z.uuid("Select a valid branch").optional();

// A trimmed-blank address normalizes to undefined (which toPersistData then
// stores as null), matching the description fields across the masters —
// without this, clearing the field on the edit form would persist "".
const ADDRESS_SCHEMA = z
  .string()
  .trim()
  .max(500, "Address must be at most 500 characters")
  .transform((value) => (value === "" ? undefined : value))
  .optional();

// Same 10-digit Indian mobile format as user-schema.ts's MOBILE_REGEX
// (10-user-management.md's mobile validation, per the spec). Blank
// normalizes to undefined so clearing the field persists null.
const CONTACT_NUMBER_REGEX = /^[6-9]\d{9}$/;

const CONTACT_NUMBER_SCHEMA = z
  .string()
  .trim()
  .transform((value) => (value === "" ? undefined : value))
  .optional()
  .refine((value) => value === undefined || CONTACT_NUMBER_REGEX.test(value), {
    message: "Enter a valid 10-digit mobile number",
  });

// `isDefault` is deliberately absent — it changes only via the dedicated
// set/unset default actions, never via Create/Edit, keeping the one-default
// invariant in a single code path (24-warehouse-management.md's Validation).
export const createWarehouseSchema = z.object({
  name: NAME_SCHEMA,
  code: CODE_SCHEMA,
  branchId: BRANCH_ID_SCHEMA,
  address: ADDRESS_SCHEMA,
  contactNumber: CONTACT_NUMBER_SCHEMA,
});

export type CreateWarehouseInput = z.infer<typeof createWarehouseSchema>;

// Create and Update share the same field set — every Warehouse field remains
// editable while nothing references a warehouse (24-warehouse-management.md;
// once stock movements exist, the Inventory Engine #30 owns the nonzero-stock
// deactivation block). Kept as a separate named schema so a future spec can
// diverge them without touching callers.
export const updateWarehouseSchema = createWarehouseSchema;

export type UpdateWarehouseInput = z.infer<typeof updateWarehouseSchema>;
