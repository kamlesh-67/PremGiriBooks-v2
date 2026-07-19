import type { DocumentType } from "@prisma/client";

import { AppError } from "@/lib/app-error";
import { getCurrentCompanyUser } from "@/lib/current-user";
import { getCurrentFinancialYear } from "@/lib/current-financial-year";
import { assertPermission } from "@/lib/permissions";
import {
  DEFAULT_PADDING,
  DOCUMENT_TYPE_DEFAULT_PREFIXES,
  DOCUMENT_TYPE_LABELS,
} from "@/engines/document-number/document-defaults";
import { documentSequenceRepository } from "@/modules/document-sequences/repositories/document-sequence-repository";
import {
  updateDocumentSequenceSchema,
  type UpdateDocumentSequenceInput,
} from "@/modules/document-sequences/validation/document-sequence-schema";
import type { DocumentSequence, DocumentSequenceListItem } from "@/types/document-sequence";

async function requireCurrentFinancialYear() {
  const financialYear = await getCurrentFinancialYear();
  if (!financialYear) {
    throw new AppError("Select an active financial year first.");
  }
  return financialYear;
}

export const documentSequenceService = {
  /**
   * Every `DocumentType`, merging the stored row with the type's default
   * prefix/padding for types never used yet — listing never materializes a
   * row (34-document-number-engine.md's Lazy row creation).
   */
  async listSequences(): Promise<DocumentSequenceListItem[]> {
    const user = await getCurrentCompanyUser();
    await assertPermission(user, "settings", "view");
    const financialYear = await requireCurrentFinancialYear();

    const stored = await documentSequenceRepository.findMany(user.companyId, financialYear.id);
    const storedByType = new Map(stored.map((row) => [row.documentType, row]));

    return (Object.keys(DOCUMENT_TYPE_LABELS) as DocumentType[]).map((documentType) => {
      const row = storedByType.get(documentType);
      return {
        documentType,
        label: DOCUMENT_TYPE_LABELS[documentType],
        prefix: row?.prefix ?? DOCUMENT_TYPE_DEFAULT_PREFIXES[documentType],
        padding: row?.padding ?? DEFAULT_PADDING,
        nextNumber: row?.nextNumber ?? 1,
        isConfigured: row !== undefined,
      };
    });
  },

  async updateSequence(
    documentType: DocumentType,
    input: UpdateDocumentSequenceInput
  ): Promise<DocumentSequence> {
    const user = await getCurrentCompanyUser();
    await assertPermission(user, "settings", "edit");
    const financialYear = await requireCurrentFinancialYear();

    const data = updateDocumentSequenceSchema.parse(input);
    return documentSequenceRepository.upsert(user.companyId, financialYear.id, documentType, data);
  },
};
