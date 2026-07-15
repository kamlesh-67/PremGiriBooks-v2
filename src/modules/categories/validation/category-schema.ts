import { z } from "zod";

const NAME_SCHEMA = z
  .string()
  .trim()
  .min(2, "Name must be at least 2 characters")
  .max(100, "Name must be at most 100 characters");

// The server re-verifies company scope, active status, and the no-cycle rule
// for the parent — this only guards the shape (20-category-management.md's
// "never trust the client").
const PARENT_CATEGORY_ID_SCHEMA = z.uuid("Select a valid parent category").optional();

// A trimmed-blank description normalizes to undefined (which toPersistData
// then stores as null), matching unit-schema.ts's DESCRIPTION_SCHEMA —
// without this, clearing the field on the edit form would persist "" instead
// of null.
const DESCRIPTION_SCHEMA = z
  .string()
  .trim()
  .max(500, "Description must be at most 500 characters")
  .transform((value) => (value === "" ? undefined : value))
  .optional();

export const createCategorySchema = z.object({
  name: NAME_SCHEMA,
  parentCategoryId: PARENT_CATEGORY_ID_SCHEMA,
  description: DESCRIPTION_SCHEMA,
});

export type CreateCategoryInput = z.infer<typeof createCategorySchema>;

// Create and Update share the same field set — every Category field remains
// editable, including the parent (20-category-management.md's deliberate
// divergence from Ledger Groups). Kept as a separate named schema so a
// future spec can diverge them without touching callers.
export const updateCategorySchema = createCategorySchema;

export type UpdateCategoryInput = z.infer<typeof updateCategorySchema>;
