import type { DocumentType, Prisma } from "@prisma/client";

import { AppError } from "@/lib/app-error";
import { prisma } from "@/lib/prisma";
import { isRecordNotFoundError, isUniqueConstraintError } from "@/lib/prisma-errors";
import { DEFAULT_PADDING, DOCUMENT_TYPE_DEFAULT_PREFIXES } from "@/engines/document-number/document-defaults";
import {
  documentSequenceRefSchema,
  type DocumentSequenceRefInput,
  type GeneratedNumber,
  type PreviewedNumber,
} from "@/engines/document-number/types";

// Postgres INT4 upper bound — `nextNumber` maps to a 32-bit column
// (34-document-number-engine.md's documented, deliberate backend maximum).
// The row's stored `nextNumber` is always one AHEAD of the last assigned
// number (see generateNumber's comment), so the last number this engine can
// safely assign is INT4_MAX - 1: assigning INT4_MAX itself would require
// incrementing the stored column past the column's own range.
export const INT4_MAX = 2147483647;

// The settings schema bounds `padding` to 1-8 at the only write path, but
// `formatNumber` also renders whatever is already stored in the column
// (document-sequence-schema.ts's bound doesn't retroactively apply to old
// rows or a direct DB edit) — clamp defensively so a corrupted/out-of-range
// value can't drive `padStart` into an unbounded string allocation. Well
// above any bound the settings schema would ever accept, so it never
// affects a legitimately configured sequence.
const MAX_SAFE_PADDING = 64;

type PrismaClientOrTransaction = typeof prisma | Prisma.TransactionClient;

/**
 * `{prefix}-{paddedNumber}` (34-document-number-engine.md's Format
 * decision). Pure and unit-tested — a number that exceeds its configured
 * padding width grows naturally (`INV-10000`); no width-based cap or
 * truncation exists here.
 */
export function formatNumber(prefix: string, padding: number, number: number): string {
  const safePadding = Math.min(padding, MAX_SAFE_PADDING);
  return `${prefix}-${String(number).padStart(safePadding, "0")}`;
}

/**
 * Numbering into a closed year, or a financial year that doesn't belong to
 * the caller's company, is rejected — the same rule the Voucher Engine
 * enforces independently for posting itself. Accepts either the shared
 * client or the caller's open transaction so both `ensureSequence` (runs
 * before any transaction) and `generateNumber` (runs inside one) can share
 * this check.
 */
async function assertFinancialYearOpen(
  client: PrismaClientOrTransaction,
  companyId: string,
  financialYearId: string
): Promise<void> {
  const financialYear = await client.financialYear.findUnique({ where: { id: financialYearId } });
  if (!financialYear || financialYear.companyId !== companyId) {
    throw new AppError("Financial year not found.");
  }
  if (financialYear.isClosed) {
    throw new AppError("Numbers cannot be generated for a closed financial year.");
  }
}

/**
 * Idempotent create-if-missing of the (company, FY, type) sequence row,
 * seeded with the type's default prefix/padding. Runs OUTSIDE and BEFORE the
 * caller's posting transaction, in its own short-lived statement — Postgres
 * aborts an entire transaction on any statement error, so a first-use race
 * (two callers creating the same row concurrently) cannot be caught and
 * resolved from inside an already-open interactive transaction without
 * savepoints. Callers must call this, then open their own transaction and
 * call `generateNumber` inside it (34-document-number-engine.md's two-step
 * design).
 */
export async function ensureSequence(
  companyId: string,
  financialYearId: string,
  documentType: DocumentType
): Promise<void> {
  await assertFinancialYearOpen(prisma, companyId, financialYearId);

  const existing = await prisma.documentSequence.findUnique({
    where: { companyId_financialYearId_documentType: { companyId, financialYearId, documentType } },
  });
  if (existing) {
    return;
  }

  try {
    await prisma.documentSequence.create({
      data: {
        companyId,
        financialYearId,
        documentType,
        prefix: DOCUMENT_TYPE_DEFAULT_PREFIXES[documentType],
        padding: DEFAULT_PADDING,
      },
    });
  } catch (error) {
    // A concurrent first use raced us and won — bounded retry: re-read once
    // more before giving up, since the winner's row must be visible by now.
    if (isUniqueConstraintError(error)) {
      const createdByRace = await prisma.documentSequence.findUnique({
        where: { companyId_financialYearId_documentType: { companyId, financialYearId, documentType } },
      });
      if (createdByRace) {
        return;
      }
    }
    throw error;
  }
}

/**
 * Atomic, transaction-participating next-number generation — the exact
 * mechanism the Voucher Engine's "no duplicate numbers under concurrency"
 * success criterion exercises. Performs ONLY the atomic
 * `nextNumber: { increment: 1 }` on the unique triple; the caller must have
 * already run `ensureSequence` (a missing row here is a contract violation,
 * not a normal rejection). If the caller's transaction later aborts, this
 * increment rolls back with it — numbers are only consumed by committed
 * documents.
 */
export async function generateNumber(
  tx: Prisma.TransactionClient,
  rawInput: DocumentSequenceRefInput
): Promise<GeneratedNumber> {
  const input = documentSequenceRefSchema.parse(rawInput);
  await assertFinancialYearOpen(tx, input.companyId, input.financialYearId);

  try {
    // The stored `nextNumber` is always one ahead of the last-assigned
    // number, so the increment must be refused once it currently equals
    // INT4_MAX — incrementing it further would overflow the column.
    const updated = await tx.documentSequence.update({
      where: {
        companyId_financialYearId_documentType: {
          companyId: input.companyId,
          financialYearId: input.financialYearId,
          documentType: input.documentType,
        },
        nextNumber: { lt: INT4_MAX },
      },
      data: { nextNumber: { increment: 1 } },
    });

    const assignedNumber = updated.nextNumber - 1;
    return {
      documentSequenceId: updated.id,
      number: assignedNumber,
      formatted: formatNumber(updated.prefix, updated.padding, assignedNumber),
    };
  } catch (error) {
    if (!isRecordNotFoundError(error)) {
      throw error;
    }

    const existing = await tx.documentSequence.findUnique({
      where: {
        companyId_financialYearId_documentType: {
          companyId: input.companyId,
          financialYearId: input.financialYearId,
          documentType: input.documentType,
        },
      },
    });
    if (!existing) {
      throw new AppError(
        "Document sequence not initialized — ensureSequence must run before generateNumber."
      );
    }
    throw new AppError(
      `The ${input.documentType} numbering sequence has reached its maximum number and cannot generate further numbers.`
    );
  }
}

/**
 * Non-consuming read for form display ("next number will be…") — the
 * displayed number is advisory only; the posted number is whatever
 * `generateNumber` returns inside the posting transaction. Ensures the
 * sequence row exists (so a brand-new document type still previews
 * correctly) without incrementing it.
 */
export async function previewNextNumber(rawInput: DocumentSequenceRefInput): Promise<PreviewedNumber> {
  const input = documentSequenceRefSchema.parse(rawInput);
  await ensureSequence(input.companyId, input.financialYearId, input.documentType);

  const sequence = await prisma.documentSequence.findUniqueOrThrow({
    where: {
      companyId_financialYearId_documentType: {
        companyId: input.companyId,
        financialYearId: input.financialYearId,
        documentType: input.documentType,
      },
    },
  });

  return {
    number: sequence.nextNumber,
    formatted: formatNumber(sequence.prefix, sequence.padding, sequence.nextNumber),
  };
}

export const documentNumberEngine = {
  ensureSequence,
  generateNumber,
  previewNextNumber,
  formatNumber,
};
