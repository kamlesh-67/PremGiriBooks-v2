import {
  Prisma,
  type BalanceType,
  type Voucher as PrismaVoucher,
  type VoucherEntry as PrismaVoucherEntry,
} from "@prisma/client";

import { prisma } from "@/lib/prisma";
import type { GeneratedNumber } from "@/engines/document-number/types";
import type {
  LedgerStatementLine,
  PostedVoucher,
  PostVoucherInput,
  VoucherListFilters,
} from "@/engines/voucher/types";
import { toPaise } from "@/engines/voucher/voucher-validation";

type PrismaClientOrTransaction = typeof prisma | Prisma.TransactionClient;

type VoucherWithEntries = PrismaVoucher & { entries: PrismaVoucherEntry[] };

// Decimal -> number normalization at the repository boundary (established
// convention, e.g. ledger-repository.ts's toLedger) — entries are also
// re-sorted by lineNumber since Prisma's `include` does not guarantee row
// order.
function toPostedVoucher(raw: VoucherWithEntries): PostedVoucher {
  return {
    id: raw.id,
    companyId: raw.companyId,
    financialYearId: raw.financialYearId,
    voucherType: raw.voucherType,
    voucherNumber: raw.voucherNumber,
    voucherDate: raw.voucherDate,
    status: raw.status,
    narration: raw.narration,
    referenceType: raw.referenceType,
    referenceId: raw.referenceId,
    totalAmount: raw.totalAmount.toNumber(),
    reversalOfId: raw.reversalOfId,
    createdByUserId: raw.createdByUserId,
    createdAt: raw.createdAt,
    updatedAt: raw.updatedAt,
    entries: raw.entries
      .slice()
      .sort((a, b) => a.lineNumber - b.lineNumber)
      .map((entry) => ({
        id: entry.id,
        ledgerId: entry.ledgerId,
        entryType: entry.entryType,
        amount: entry.amount.toNumber(),
        lineNumber: entry.lineNumber,
      })),
  };
}

function buildWhere(companyId: string, filters: VoucherListFilters): Prisma.VoucherWhereInput {
  const where: Prisma.VoucherWhereInput = { companyId };

  if (filters.voucherType) {
    where.voucherType = filters.voucherType;
  }
  if (filters.status) {
    where.status = filters.status;
  }
  if (filters.financialYearId) {
    where.financialYearId = filters.financialYearId;
  }
  if (filters.referenceType) {
    where.referenceType = filters.referenceType;
  }
  if (filters.referenceId) {
    where.referenceId = filters.referenceId;
  }
  if (filters.fromDate || filters.toDate) {
    where.voucherDate = {
      ...(filters.fromDate ? { gte: filters.fromDate } : {}),
      ...(filters.toDate ? { lte: filters.toDate } : {}),
    };
  }

  return where;
}

export interface LedgerForBalance {
  id: string;
  openingBalance: number;
  openingBalanceType: BalanceType;
}

export interface LedgerForTrialBalance extends LedgerForBalance {
  name: string;
  ledgerGroupId: string;
}

export interface LedgerEntryTotal {
  ledgerId: string;
  entryType: BalanceType;
  amount: number;
}

export const voucherRepository = {
  /**
   * Creates the Voucher + its VoucherEntry rows atomically. `input.entries`
   * order becomes each entry's 1-based `lineNumber` — always runs inside the
   * caller's transaction (voucher-engine.ts never calls this outside one),
   * so a partial write is never observable.
   */
  async create(
    tx: Prisma.TransactionClient,
    companyId: string,
    input: Omit<PostVoucherInput, "voucherDate"> & { voucherDate: Date },
    generated: GeneratedNumber
  ): Promise<PostedVoucher> {
    const totalAmount = input.entries
      .filter((entry) => entry.entryType === "DEBIT")
      .reduce((sum, entry) => sum + toPaise(entry.amount), 0) / 100;

    const created = await tx.voucher.create({
      data: {
        companyId,
        financialYearId: input.financialYearId,
        voucherType: input.voucherType,
        voucherNumber: generated.formatted,
        voucherDate: input.voucherDate,
        narration: input.narration ?? null,
        referenceType: input.referenceType ?? null,
        referenceId: input.referenceId ?? null,
        totalAmount,
        createdByUserId: input.createdByUserId ?? null,
        entries: {
          create: input.entries.map((entry, index) => ({
            ledgerId: entry.ledgerId,
            entryType: entry.entryType,
            amount: entry.amount,
            lineNumber: index + 1,
          })),
        },
      },
      include: { entries: true },
    });

    return toPostedVoucher(created);
  },

  /**
   * Creates the mirrored reversal voucher (DEBIT<->CREDIT swapped, same
   * ledgers/amounts/line numbers) and flips `original` to CANCELLED, both
   * inside the caller's transaction. The reversal's `voucherDate` reuses
   * `original.voucherDate` rather than "today" — the original date is
   * already known to fall inside the (still-open) financial year's range,
   * so reusing it sidesteps re-validating a fresh date against that range.
   */
  async reverse(
    tx: Prisma.TransactionClient,
    companyId: string,
    original: PostedVoucher,
    generated: GeneratedNumber
  ): Promise<PostedVoucher> {
    const flip = (entryType: BalanceType): BalanceType => (entryType === "DEBIT" ? "CREDIT" : "DEBIT");

    const reversal = await tx.voucher.create({
      data: {
        companyId,
        financialYearId: original.financialYearId,
        voucherType: original.voucherType,
        voucherNumber: generated.formatted,
        voucherDate: original.voucherDate,
        narration: `Reversal of ${original.voucherNumber}`,
        totalAmount: original.totalAmount,
        reversalOfId: original.id,
        entries: {
          create: original.entries.map((entry) => ({
            ledgerId: entry.ledgerId,
            entryType: flip(entry.entryType),
            amount: entry.amount,
            lineNumber: entry.lineNumber,
          })),
        },
      },
      include: { entries: true },
    });

    await tx.voucher.update({ where: { id: original.id }, data: { status: "CANCELLED" } });

    return toPostedVoucher(reversal);
  },

  async findById(id: string, client: PrismaClientOrTransaction = prisma): Promise<PostedVoucher | null> {
    const row = await client.voucher.findUnique({ where: { id }, include: { entries: true } });
    return row ? toPostedVoucher(row) : null;
  },

  /** Batch lookup for postVoucher's "every ledgerId belongs to the company and is active" check. */
  async findLedgersForPosting(
    client: PrismaClientOrTransaction,
    ledgerIds: readonly string[]
  ): Promise<{ id: string; companyId: string; name: string; isActive: boolean }[]> {
    return client.ledger.findMany({
      where: { id: { in: [...ledgerIds] } },
      select: { id: true, companyId: true, name: true, isActive: true },
    });
  },

  /** For the FY-open/date-range and FY-not-closed checks postVoucher and cancelVoucher each enforce. */
  async findFinancialYear(
    client: PrismaClientOrTransaction,
    id: string
  ): Promise<{ id: string; companyId: string; isClosed: boolean; startDate: Date; endDate: Date } | null> {
    return client.financialYear.findUnique({
      where: { id },
      select: { id: true, companyId: true, isClosed: true, startDate: true, endDate: true },
    });
  },

  async findMany(companyId: string, filters: VoucherListFilters = {}): Promise<PostedVoucher[]> {
    const rows = await prisma.voucher.findMany({
      where: buildWhere(companyId, filters),
      include: { entries: true },
      orderBy: [{ voucherDate: "desc" }, { voucherNumber: "desc" }],
    });
    return rows.map(toPostedVoucher);
  },

  /** Company-scoped: returns `null` for a cross-company id (resolves as not-found, never leaks existence). */
  async findLedgerForBalance(companyId: string, ledgerId: string): Promise<LedgerForBalance | null> {
    const ledger = await prisma.ledger.findUnique({ where: { id: ledgerId } });
    if (!ledger || ledger.companyId !== companyId) {
      return null;
    }
    return { id: ledger.id, openingBalance: ledger.openingBalance.toNumber(), openingBalanceType: ledger.openingBalanceType };
  },

  /** Every ledger in the company — a Trial Balance lists every ledger, including ones with zero activity in the requested year. */
  async findLedgersForTrialBalance(companyId: string): Promise<LedgerForTrialBalance[]> {
    const rows = await prisma.ledger.findMany({ where: { companyId }, orderBy: { name: "asc" } });
    return rows.map((row) => ({
      id: row.id,
      name: row.name,
      ledgerGroupId: row.ledgerGroupId,
      openingBalance: row.openingBalance.toNumber(),
      openingBalanceType: row.openingBalanceType,
    }));
  },

  /**
   * Every entry ever posted against `ledgerId` (across ALL voucher
   * statuses) up to and including `upToDate`. Deliberately does NOT filter
   * by voucher status — a CANCELLED voucher's original entries and its
   * mirrored reversal entries must both count so their net effect on the
   * balance is zero (the whole point of reversal-based cancellation:
   * both transactions stay visible for audit, and their sum self-corrects).
   */
  async findLedgerEntriesUpTo(companyId: string, ledgerId: string, upToDate?: Date): Promise<LedgerStatementLine[]> {
    const rows = await prisma.voucherEntry.findMany({
      where: {
        ledgerId,
        voucher: {
          companyId,
          ...(upToDate ? { voucherDate: { lte: upToDate } } : {}),
        },
      },
      include: {
        voucher: {
          select: { id: true, voucherNumber: true, voucherType: true, voucherDate: true, narration: true },
        },
      },
      orderBy: [{ voucher: { voucherDate: "asc" } }, { voucher: { voucherNumber: "asc" } }, { lineNumber: "asc" }],
    });

    return rows.map((row) => ({
      voucherId: row.voucher.id,
      voucherNumber: row.voucher.voucherNumber,
      voucherType: row.voucher.voucherType,
      voucherDate: row.voucher.voucherDate,
      narration: row.voucher.narration,
      entryType: row.entryType,
      amount: row.amount.toNumber(),
      runningBalance: 0, // filled in by voucher-queries.ts as it walks the list
    }));
  },

  /**
   * Per-ledger DEBIT/CREDIT sums for one financial year (optionally as of a
   * date), via `groupBy` on entries — the aggregation this engine exposes as
   * the Trial Balance data primitive (Reports #61 renders it). Same
   * all-statuses reasoning as `findLedgerEntriesUpTo` applies here.
   */
  async aggregateEntriesByLedger(
    companyId: string,
    financialYearId: string,
    asOfDate?: Date
  ): Promise<LedgerEntryTotal[]> {
    const groups = await prisma.voucherEntry.groupBy({
      by: ["ledgerId", "entryType"],
      where: {
        voucher: {
          companyId,
          financialYearId,
          ...(asOfDate ? { voucherDate: { lte: asOfDate } } : {}),
        },
      },
      _sum: { amount: true },
    });

    return groups.map((group) => ({
      ledgerId: group.ledgerId,
      entryType: group.entryType,
      amount: (group._sum.amount ?? new Prisma.Decimal(0)).toNumber(),
    }));
  },
};
