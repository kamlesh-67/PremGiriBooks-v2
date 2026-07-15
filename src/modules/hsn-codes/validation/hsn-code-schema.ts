import { z } from "zod";

// Plain string-literal tuple (not the @prisma/client enum object) so the
// client-side form can import this module without pulling the Prisma runtime
// into the browser bundle. The literals are type-compatible with Prisma's
// HsnCodeType union.
export const HSN_CODE_TYPES = ["HSN", "SAC"] as const;

// The digit lengths GSTR-1 accepts for an HSN code (22-hsn-management.md).
const HSN_CODE_LENGTHS = [4, 6, 8];
const SAC_CODE_LENGTH = 6;

const CODE_SCHEMA = z
  .string()
  .trim()
  .min(1, "Code is required")
  .regex(/^[0-9]+$/, "Code must contain digits only");

const CODE_TYPE_SCHEMA = z.enum(HSN_CODE_TYPES, "Code type must be HSN or SAC");

const DESCRIPTION_SCHEMA = z
  .string()
  .trim()
  .min(2, "Description must be at least 2 characters")
  .max(200, "Description must be at most 200 characters");

// The valid code length depends on the code type (HSN: 4/6/8 digits, the
// lengths GSTR-1 accepts; SAC: exactly 6), so it lives in an object-level
// superRefine rather than on CODE_SCHEMA. Zod only runs the refinement once
// every field parses, so a non-digit code surfaces the digits-only message
// alone, not both.
export const createHsnCodeSchema = z
  .object({
    code: CODE_SCHEMA,
    codeType: CODE_TYPE_SCHEMA,
    description: DESCRIPTION_SCHEMA,
  })
  .superRefine((data, ctx) => {
    if (data.codeType === "SAC" && data.code.length !== SAC_CODE_LENGTH) {
      ctx.addIssue({
        code: "custom",
        path: ["code"],
        message: "A SAC code must be exactly 6 digits",
      });
    }

    if (data.codeType === "HSN" && !HSN_CODE_LENGTHS.includes(data.code.length)) {
      ctx.addIssue({
        code: "custom",
        path: ["code"],
        message: "An HSN code must be exactly 4, 6, or 8 digits",
      });
    }
  });

export type CreateHsnCodeInput = z.infer<typeof createHsnCodeSchema>;

// Create and Update share the same field set — every HsnCode field remains
// editable, including code and codeType (22-hsn-management.md: nothing
// references an HSN row until Product Management exists). Kept as a separate
// named schema so a future spec can diverge them without touching callers.
export const updateHsnCodeSchema = createHsnCodeSchema;

export type UpdateHsnCodeInput = z.infer<typeof updateHsnCodeSchema>;
