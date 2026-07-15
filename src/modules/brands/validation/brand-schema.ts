import { z } from "zod";

const NAME_SCHEMA = z
  .string()
  .trim()
  .min(2, "Name must be at least 2 characters")
  .max(100, "Name must be at most 100 characters");

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

export const createBrandSchema = z.object({
  name: NAME_SCHEMA,
  description: DESCRIPTION_SCHEMA,
});

export type CreateBrandInput = z.infer<typeof createBrandSchema>;

// Create and Update share the same field set — every Brand field remains
// editable (21-brand-management.md: no dependents exist until Product
// Management, and nothing financial references a Brand). Kept as a separate
// named schema so a future spec can diverge them without touching callers.
export const updateBrandSchema = createBrandSchema;

export type UpdateBrandInput = z.infer<typeof updateBrandSchema>;
