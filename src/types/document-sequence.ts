import type { DocumentSequence as PrismaDocumentSequence, DocumentType } from "@prisma/client";

// No Decimal columns — the Prisma row is already serializable across the
// Server Component / Server Action boundary as-is (mirrors types/unit.ts).
export type DocumentSequence = PrismaDocumentSequence;

export type { DocumentType };

/**
 * One row per `DocumentType` for the settings screen — merges the stored
 * config with the type's default prefix/padding for types that have never
 * been used yet (`isConfigured: false`), without materializing a row for
 * them (34-document-number-engine.md's Lazy row creation).
 */
export interface DocumentSequenceListItem {
  documentType: DocumentType;
  label: string;
  prefix: string;
  padding: number;
  nextNumber: number;
  isConfigured: boolean;
}
