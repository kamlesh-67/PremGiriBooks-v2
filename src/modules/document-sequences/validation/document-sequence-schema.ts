import { z } from "zod";

// GST's 16-character document-number limit bounds prefix + padding together
// (see the object-level refine below) — kept printable and GST-safe:
// uppercase alphanumeric plus `/ -` (34-document-number-engine.md's
// Validation).
const PREFIX_SCHEMA = z
  .string()
  .trim()
  .toUpperCase()
  .min(1, "Prefix is required")
  .max(10, "Prefix must be at most 10 characters")
  .regex(/^[A-Z0-9/ -]+$/, "Prefix may only contain letters, numbers, and / - characters");

const PADDING_SCHEMA = z
  .number("Padding must be a number")
  .int("Padding must be a whole number")
  .min(1, "Padding must be between 1 and 8")
  .max(8, "Padding must be between 1 and 8");

// `prefix.length + 1 (the separator) + padding <= 16` keeps every formatted
// number within GST's 16-character document-number limit at its configured
// width — the width-based cap is deliberately advisory-only past this point
// (see document-number-engine.ts's formatNumber), so this refine is the one
// place width is actually bounded.
export const updateDocumentSequenceSchema = z
  .object({
    prefix: PREFIX_SCHEMA,
    padding: PADDING_SCHEMA,
  })
  .refine((data) => data.prefix.length + 1 + data.padding <= 16, {
    message: "Prefix and padding combined must fit within 16 characters",
    path: ["prefix"],
  });

export type UpdateDocumentSequenceInput = z.infer<typeof updateDocumentSequenceSchema>;
