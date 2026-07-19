import type { DocumentType } from "@prisma/client";
import { z } from "zod";

import { DOCUMENT_TYPE_LABELS } from "@/engines/document-number/document-defaults";

// Cast (not a plain string[]) so z.enum infers the literal DocumentType
// union rather than `string` — DOCUMENT_TYPE_LABELS is exhaustive over
// DocumentType by construction (document-defaults.ts), so this stays in
// sync with the enum automatically.
const DOCUMENT_TYPE_VALUES = Object.keys(DOCUMENT_TYPE_LABELS) as [DocumentType, ...DocumentType[]];

// Engines are system boundaries for their consumers even though they are not
// HTTP boundaries (30-pricing-engine.md's Validation convention) —
// `companyId` is the authorized caller's tenant scope, never trusted from
// client input; every loaded row is still re-verified against it inside
// document-number-engine.ts (defense in depth, the standing engine
// convention).
export const documentSequenceRefSchema = z.object({
  companyId: z.uuid("A valid company is required"),
  financialYearId: z.uuid("A valid financial year is required"),
  documentType: z.enum(DOCUMENT_TYPE_VALUES, "Select a valid document type"),
});

export type DocumentSequenceRefInput = z.infer<typeof documentSequenceRefSchema>;

export interface GeneratedNumber {
  documentSequenceId: string;
  /** The assigned numeric suffix — monotonically increasing, never reused. */
  number: number;
  /** `{prefix}-{paddedNumber}` — see `formatNumber`. */
  formatted: string;
}

export type PreviewedNumber = Omit<GeneratedNumber, "documentSequenceId">;
