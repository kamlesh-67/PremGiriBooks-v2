"use server";

import type { DocumentType } from "@prisma/client";

import { runAction } from "@/lib/run-action";
import { documentSequenceService } from "@/modules/document-sequences/services/document-sequence-service";
import type { UpdateDocumentSequenceInput } from "@/modules/document-sequences/validation/document-sequence-schema";
import type { ActionResult } from "@/types/api";
import type { DocumentSequence } from "@/types/document-sequence";

const LIST_PATH = "/settings/document-numbering";

export async function updateDocumentSequenceAction(
  documentType: DocumentType,
  input: UpdateDocumentSequenceInput
): Promise<ActionResult<DocumentSequence>> {
  return runAction(() => documentSequenceService.updateSequence(documentType, input), [LIST_PATH]);
}
