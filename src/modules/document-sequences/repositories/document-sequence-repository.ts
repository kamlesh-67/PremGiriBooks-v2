import { prisma } from "@/lib/prisma";
import type { DocumentSequence, DocumentType } from "@/types/document-sequence";

export interface DocumentSequencePersistData {
  prefix: string;
  padding: number;
}

/**
 * The only Prisma access for the Document Numbering settings surface — the
 * generation engine (`document-number-engine.ts`) reads/writes the same
 * table directly, since it needs the caller's raw transaction client
 * (34-document-number-engine.md's Structure).
 */
export const documentSequenceRepository = {
  findMany(companyId: string, financialYearId: string): Promise<DocumentSequence[]> {
    return prisma.documentSequence.findMany({ where: { companyId, financialYearId } });
  },

  /**
   * Settings edits apply to numbers generated after the change only — this
   * never touches `nextNumber` (create seeds it at the column default of 1;
   * update leaves it untouched), so no in-flight sequence is ever rewound or
   * skipped by an admin editing the prefix/padding.
   */
  upsert(
    companyId: string,
    financialYearId: string,
    documentType: DocumentType,
    data: DocumentSequencePersistData
  ): Promise<DocumentSequence> {
    return prisma.documentSequence.upsert({
      where: { companyId_financialYearId_documentType: { companyId, financialYearId, documentType } },
      create: { companyId, financialYearId, documentType, ...data },
      update: data,
    });
  },
};
