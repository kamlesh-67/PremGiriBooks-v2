import { Prisma, type DocumentType, type VoucherType } from "@prisma/client";

import { AppError } from "@/lib/app-error";
import { isUniqueConstraintError } from "@/lib/prisma-errors";
import { runInTransaction } from "@/lib/transaction";
import { documentNumberEngine } from "@/engines/document-number/document-number-engine";
import { postVoucherInputSchema, toUtcDate, type VoucherEntryLineInput } from "@/engines/voucher/voucher-validation";
import type { PostedVoucher, VoucherListFilters } from "@/engines/voucher/types";
import { voucherRepository } from "@/modules/vouchers/repositories/voucher-repository";

// Every VoucherType maps 1:1 onto a `{TYPE}_VOUCHER` DocumentType entry
// (34-document-number-engine.md's enum was designed with this pairing) —
// the Voucher Engine owns numbering by delegating to the Document Number
// Engine under that type, never by generating numbers itself.
const VOUCHER_TYPE_TO_DOCUMENT_TYPE: Record<VoucherType, DocumentType> = {
  PAYMENT: "PAYMENT_VOUCHER",
  RECEIPT: "RECEIPT_VOUCHER",
  CONTRA: "CONTRA_VOUCHER",
  JOURNAL: "JOURNAL_VOUCHER",
  SALES: "SALES_VOUCHER",
  PURCHASE: "PURCHASE_VOUCHER",
  CREDIT_NOTE: "CREDIT_NOTE_VOUCHER",
  DEBIT_NOTE: "DEBIT_NOTE_VOUCHER",
  SALES_RETURN: "SALES_RETURN_VOUCHER",
  PURCHASE_RETURN: "PURCHASE_RETURN_VOUCHER",
};

type PrismaClientOrTransaction = Parameters<typeof voucherRepository.findFinancialYear>[0];

async function assertFinancialYearOpenForDate(
  client: PrismaClientOrTransaction,
  companyId: string,
  financialYearId: string,
  voucherDate: Date,
  rejectionVerb: "posted" | "cancelled"
): Promise<void> {
  const financialYear = await voucherRepository.findFinancialYear(client, financialYearId);
  if (!financialYear || financialYear.companyId !== companyId) {
    throw new AppError("Financial year not found.");
  }
  if (financialYear.isClosed) {
    throw new AppError(`Vouchers cannot be ${rejectionVerb} in a closed financial year.`);
  }
  if (rejectionVerb === "posted" && (voucherDate < financialYear.startDate || voucherDate > financialYear.endDate)) {
    throw new AppError("Voucher date must fall within the financial year's date range.");
  }
}

async function assertLedgersActiveAndOwned(
  tx: Prisma.TransactionClient,
  companyId: string,
  entries: readonly VoucherEntryLineInput[]
): Promise<void> {
  const ledgerIds = [...new Set(entries.map((entry) => entry.ledgerId))];
  const ledgers = await voucherRepository.findLedgersForPosting(tx, ledgerIds);
  const byId = new Map(ledgers.map((ledger) => [ledger.id, ledger]));

  for (const id of ledgerIds) {
    const ledger = byId.get(id);
    if (!ledger || ledger.companyId !== companyId) {
      throw new AppError("One or more ledgers were not found.");
    }
    if (!ledger.isActive) {
      throw new AppError(`Ledger "${ledger.name}" is inactive and cannot be posted to.`);
    }
  }
}

async function postVoucherInTransaction(
  tx: Prisma.TransactionClient,
  companyId: string,
  input: ReturnType<typeof postVoucherInputSchema.parse>,
  documentType: DocumentType
): Promise<PostedVoucher> {
  const voucherDate = toUtcDate(input.voucherDate);
  await assertFinancialYearOpenForDate(tx, companyId, input.financialYearId, voucherDate, "posted");
  await assertLedgersActiveAndOwned(tx, companyId, input.entries);

  const generated = await documentNumberEngine.generateNumber(tx, {
    companyId,
    financialYearId: input.financialYearId,
    documentType,
  });

  return voucherRepository.create(tx, companyId, { ...input, voucherDate }, generated);
}

/**
 * Validated, balanced, atomic voucher creation (31-voucher-engine.md).
 * `companyId` is the authorized caller's tenant scope, taken as an explicit
 * parameter — never trusted from `rawInput`. Accepts an optional external
 * transaction so a future document posting (invoice + voucher + stock + GST
 * rows) can be one atomic unit; when omitted, this opens its own.
 *
 * The Document Number Engine's `ensureSequence` must run in its own
 * short-lived statement BEFORE any transaction opens (its documented
 * contract) — when this call owns the transaction, it runs that step first.
 * When a `tx` is passed in, the caller already owns the transaction's
 * lifecycle and is responsible for having called `ensureSequence` before
 * opening it (mirrors the Document Number Engine's own two-step contract).
 */
export async function postVoucher(
  companyId: string,
  rawInput: unknown,
  tx?: Prisma.TransactionClient
): Promise<PostedVoucher> {
  const input = postVoucherInputSchema.parse(rawInput);
  const documentType = VOUCHER_TYPE_TO_DOCUMENT_TYPE[input.voucherType];

  if (tx) {
    return postVoucherInTransaction(tx, companyId, input, documentType);
  }

  await documentNumberEngine.ensureSequence(companyId, input.financialYearId, documentType);
  return runInTransaction((innerTx) => postVoucherInTransaction(innerTx, companyId, input, documentType));
}

/**
 * Reversal-based cancellation (never mutation). Rejects a voucher that is
 * not `POSTED`, is itself a reversal, or whose financial year is closed;
 * otherwise creates the mirrored reversal (its own generated number, same
 * type/FY, entries mirrored, narration "Reversal of {number}") and flips the
 * original to `CANCELLED`, atomically.
 */
export async function cancelVoucher(companyId: string, id: string): Promise<PostedVoucher> {
  const original = await voucherRepository.findById(id);
  if (!original || original.companyId !== companyId) {
    throw new AppError("Voucher not found.");
  }
  if (original.reversalOfId) {
    throw new AppError("A reversal voucher cannot be cancelled.");
  }
  if (original.status !== "POSTED") {
    throw new AppError("Only a posted voucher can be cancelled.");
  }

  const documentType = VOUCHER_TYPE_TO_DOCUMENT_TYPE[original.voucherType];
  await documentNumberEngine.ensureSequence(companyId, original.financialYearId, documentType);

  return runInTransaction(async (tx) => {
    await assertFinancialYearOpenForDate(tx, companyId, original.financialYearId, original.voucherDate, "cancelled");

    // Re-verified inside the transaction to close the race with a
    // concurrent cancellation of the same voucher.
    const current = await voucherRepository.findById(id, tx);
    if (!current || current.companyId !== companyId || current.status !== "POSTED") {
      throw new AppError("Only a posted voucher can be cancelled.");
    }

    const generated = await documentNumberEngine.generateNumber(tx, {
      companyId,
      financialYearId: original.financialYearId,
      documentType,
    });

    try {
      return await voucherRepository.reverse(tx, companyId, original, generated);
    } catch (error) {
      // A truly concurrent cancellation of the same voucher can pass the
      // `current.status === "POSTED"` re-check above (read-committed
      // isolation doesn't see the peer's uncommitted write) and only collide
      // here, on `reversalOfId`'s unique constraint — surface the same
      // friendly rejection instead of a raw Prisma error.
      if (isUniqueConstraintError(error, "reversalOfId")) {
        throw new AppError("Only a posted voucher can be cancelled.");
      }
      throw error;
    }
  });
}

/** Company-scoped: a cross-company id resolves as not-found, never leaking existence. */
export async function getVoucher(companyId: string, id: string): Promise<PostedVoucher | null> {
  const voucher = await voucherRepository.findById(id);
  return voucher && voucher.companyId === companyId ? voucher : null;
}

export async function listVouchers(
  companyId: string,
  filters: VoucherListFilters = {}
): Promise<PostedVoucher[]> {
  return voucherRepository.findMany(companyId, filters);
}

export const voucherEngine = {
  postVoucher,
  cancelVoucher,
  getVoucher,
  listVouchers,
};
