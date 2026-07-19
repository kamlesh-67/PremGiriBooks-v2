import type { BalanceType } from "@prisma/client";

import { AppError } from "@/lib/app-error";
import { prisma } from "@/lib/prisma";
import { voucherRepository } from "@/modules/vouchers/repositories/voucher-repository";
import type {
  LedgerBalanceResult,
  LedgerStatementLine,
  LedgerStatementResult,
  TrialBalanceResult,
  TrialBalanceRow,
} from "@/engines/voucher/types";

// Half-up rounding at 2 decimals for display-ready totals — the same
// convention pricing-engine.ts's price-resolution.ts uses for its own
// rounded results.
function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

/** `openingBalance`, signed debit-positive by `openingBalanceType`. */
function signedOpening(openingBalance: number, openingBalanceType: BalanceType): number {
  return openingBalanceType === "DEBIT" ? openingBalance : -openingBalance;
}

/**
 * `closing = Ledger.openingBalance (signed by openingBalanceType) + Σ debits
 * − Σ credits`, debit-positive (31-voucher-engine.md's Business Rules).
 * Reports (#61–#63) apply their own presentation sign per the ledger
 * group's `accountNature` — this engine only returns the raw sums and the
 * signed net.
 */
export async function getLedgerBalance(
  companyId: string,
  ledgerId: string,
  asOfDate?: Date
): Promise<LedgerBalanceResult> {
  const ledger = await voucherRepository.findLedgerForBalance(companyId, ledgerId);
  if (!ledger) {
    throw new AppError("Ledger not found.");
  }

  const entries = await voucherRepository.findLedgerEntriesUpTo(companyId, ledgerId, asOfDate);
  const totalDebit = round2(entries.filter((entry) => entry.entryType === "DEBIT").reduce((sum, entry) => sum + entry.amount, 0));
  const totalCredit = round2(entries.filter((entry) => entry.entryType === "CREDIT").reduce((sum, entry) => sum + entry.amount, 0));
  const netMovement = round2(totalDebit - totalCredit);
  const closingBalance = round2(signedOpening(ledger.openingBalance, ledger.openingBalanceType) + netMovement);

  return {
    ledgerId,
    openingBalance: ledger.openingBalance,
    openingBalanceType: ledger.openingBalanceType,
    totalDebit,
    totalCredit,
    netMovement,
    closingBalance,
  };
}

/**
 * The Cash Book / Bank Book / Ledger Inquiry primitive: dated entries with a
 * running balance. `openingBalance` is the debit-positive balance
 * immediately before `from` (the statement's "opening balance b/f" figure);
 * `closingBalance` is the balance as of `to`.
 */
export async function getLedgerStatement(
  companyId: string,
  ledgerId: string,
  from: Date,
  to: Date
): Promise<LedgerStatementResult> {
  const ledger = await voucherRepository.findLedgerForBalance(companyId, ledgerId);
  if (!ledger) {
    throw new AppError("Ledger not found.");
  }

  const entries = await voucherRepository.findLedgerEntriesUpTo(companyId, ledgerId, to);

  let running = signedOpening(ledger.openingBalance, ledger.openingBalanceType);
  let openingAtFrom = running;
  const lines: LedgerStatementLine[] = [];

  for (const entry of entries) {
    const delta = entry.entryType === "DEBIT" ? entry.amount : -entry.amount;
    running = round2(running + delta);
    if (entry.voucherDate < from) {
      openingAtFrom = running;
      continue;
    }
    lines.push({ ...entry, runningBalance: running });
  }

  return { ledgerId, openingBalance: openingAtFrom, lines, closingBalance: running };
}

/**
 * Per-ledger debit/credit totals + opening balances for one financial year
 * (Reports #61 renders this data primitive). Lists every ledger in the
 * company, including ones with zero activity in the requested year — a
 * Trial Balance is complete only when every account appears.
 */
export async function getTrialBalance(
  companyId: string,
  financialYearId: string,
  asOfDate?: Date
): Promise<TrialBalanceResult> {
  const financialYear = await voucherRepository.findFinancialYear(prisma, financialYearId);
  if (!financialYear || financialYear.companyId !== companyId) {
    throw new AppError("Financial year not found.");
  }

  const [ledgers, entryTotals] = await Promise.all([
    voucherRepository.findLedgersForTrialBalance(companyId),
    voucherRepository.aggregateEntriesByLedger(companyId, financialYearId, asOfDate),
  ]);

  const totalsByLedger = new Map<string, { debit: number; credit: number }>();
  for (const total of entryTotals) {
    const bucket = totalsByLedger.get(total.ledgerId) ?? { debit: 0, credit: 0 };
    if (total.entryType === "DEBIT") {
      bucket.debit += total.amount;
    } else {
      bucket.credit += total.amount;
    }
    totalsByLedger.set(total.ledgerId, bucket);
  }

  const rows: TrialBalanceRow[] = ledgers.map((ledger) => {
    const totals = totalsByLedger.get(ledger.id) ?? { debit: 0, credit: 0 };
    const totalDebit = round2(totals.debit);
    const totalCredit = round2(totals.credit);
    const closingBalance = round2(signedOpening(ledger.openingBalance, ledger.openingBalanceType) + totalDebit - totalCredit);
    return {
      ledgerId: ledger.id,
      ledgerName: ledger.name,
      ledgerGroupId: ledger.ledgerGroupId,
      openingBalance: ledger.openingBalance,
      openingBalanceType: ledger.openingBalanceType,
      totalDebit,
      totalCredit,
      closingBalance,
    };
  });

  const totalDebit = round2(rows.filter((row) => row.closingBalance >= 0).reduce((sum, row) => sum + row.closingBalance, 0));
  const totalCredit = round2(
    rows.filter((row) => row.closingBalance < 0).reduce((sum, row) => sum + Math.abs(row.closingBalance), 0)
  );

  return { rows, totalDebit, totalCredit };
}

export const voucherQueries = {
  getLedgerBalance,
  getLedgerStatement,
  getTrialBalance,
};
