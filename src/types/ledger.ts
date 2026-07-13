import type { BalanceType, LedgerGroup, Ledger as PrismaLedger } from "@prisma/client";

export type { BalanceType };

// `openingBalance` is normalized from Prisma's `Decimal` to a plain `number`
// at the repository layer — a `Decimal` instance does not survive the
// Server Component / Server Action serialization boundary to Client
// Components, so it must never leave the repository (mirrors the
// "passwordHash never leaves the repository layer" rule from
// 10-user-management.md).
export interface Ledger extends Omit<PrismaLedger, "openingBalance"> {
  openingBalance: number;
}

export interface LedgerWithGroup extends Ledger {
  ledgerGroup: LedgerGroup;
}

export type LedgerStatusFilter = "all" | "active" | "inactive";

export interface LedgerListFilters {
  search?: string;
  status?: LedgerStatusFilter;
  ledgerGroupId?: string;
  excludeLedgerGroupIds?: string[];
}

export type ActivateLedgerResult = { status: "not_found" } | { status: "ok"; ledger: Ledger };

export type DeactivateLedgerResult =
  | { status: "not_found" }
  | { status: "system_defined" }
  | { status: "ok"; ledger: Ledger };
