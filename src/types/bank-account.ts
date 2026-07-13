import type { BankAccount, BankAccountType } from "@prisma/client";

import type { LedgerWithGroup } from "@/types/ledger";

export type { BankAccount, BankAccountType };

export interface BankAccountWithLedger extends BankAccount {
  ledger: LedgerWithGroup;
}

export type BankAccountStatusFilter = "all" | "active" | "inactive";

export interface BankAccountListFilters {
  status?: BankAccountStatusFilter;
}

export type ActivateBankAccountResult =
  | { status: "not_found" }
  | { status: "ok"; bankAccount: BankAccountWithLedger };

export type DeactivateBankAccountResult =
  | { status: "not_found" }
  | { status: "ok"; bankAccount: BankAccountWithLedger };
