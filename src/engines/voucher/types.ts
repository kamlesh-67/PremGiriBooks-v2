import type { BalanceType, VoucherStatus, VoucherType } from "@prisma/client";

export type { PostVoucherInput, VoucherEntryLineInput } from "@/engines/voucher/voucher-validation";

export interface PostedVoucherEntry {
  id: string;
  ledgerId: string;
  entryType: BalanceType;
  amount: number;
  lineNumber: number;
}

// Decimal -> number normalized at the repository boundary (established
// convention) — this is the shape returned by every voucher-engine.ts
// method, never a raw Prisma row.
export interface PostedVoucher {
  id: string;
  companyId: string;
  financialYearId: string;
  voucherType: VoucherType;
  voucherNumber: string;
  voucherDate: Date;
  status: VoucherStatus;
  narration: string | null;
  referenceType: string | null;
  referenceId: string | null;
  totalAmount: number;
  reversalOfId: string | null;
  createdByUserId: string | null;
  createdAt: Date;
  updatedAt: Date;
  entries: PostedVoucherEntry[];
}

export interface VoucherListFilters {
  voucherType?: VoucherType;
  status?: VoucherStatus;
  financialYearId?: string;
  fromDate?: Date;
  toDate?: Date;
  referenceType?: string;
  referenceId?: string;
}

export interface LedgerBalanceResult {
  ledgerId: string;
  openingBalance: number;
  openingBalanceType: BalanceType;
  totalDebit: number;
  totalCredit: number;
  /** Signed net movement from entries only (debits − credits), debit-positive convention. */
  netMovement: number;
  /**
   * `openingBalance` (signed by `openingBalanceType`) + `netMovement` —
   * debit-positive. Reports apply their own presentation sign per the
   * ledger group's `accountNature` (31-voucher-engine.md's Business Rules).
   */
  closingBalance: number;
}

export interface LedgerStatementLine {
  voucherId: string;
  voucherNumber: string;
  voucherType: VoucherType;
  voucherDate: Date;
  narration: string | null;
  entryType: BalanceType;
  amount: number;
  /** Debit-positive running balance immediately after this entry. */
  runningBalance: number;
}

export interface LedgerStatementResult {
  ledgerId: string;
  /** Debit-positive balance immediately before `from` — the statement's "opening balance b/f" figure. */
  openingBalance: number;
  lines: LedgerStatementLine[];
  /** Debit-positive balance as of `to`. */
  closingBalance: number;
}

export interface TrialBalanceRow {
  ledgerId: string;
  ledgerName: string;
  ledgerGroupId: string;
  openingBalance: number;
  openingBalanceType: BalanceType;
  totalDebit: number;
  totalCredit: number;
  /** Debit-positive closing figure for this ledger within the requested financial year. */
  closingBalance: number;
}

export interface TrialBalanceResult {
  rows: TrialBalanceRow[];
  totalDebit: number;
  totalCredit: number;
}
