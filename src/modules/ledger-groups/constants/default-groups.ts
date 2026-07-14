import type { AccountNature } from "@prisma/client";

export interface DefaultLedgerGroupSeed {
  readonly name: string;
  readonly parent: string | null;
  readonly nature: AccountNature;
  readonly affectsGrossProfit: boolean;
}

// Named so other modules that must look up a specific default group by name
// (14-ledger-master.md's "Cash" seeding under Cash-in-Hand, its "Bank
// Accounts" subtree exclusion, 16-expense-heads.md's "Direct Expenses"/
// "Indirect Expenses" subtree scoping, and 17-income-heads.md's "Direct
// Incomes"/"Indirect Incomes" subtree scoping) reference one shared constant
// instead of re-typing the literal — a typo or rename here now fails those
// lookups loudly rather than silently.
export const CASH_IN_HAND_GROUP_NAME = "Cash-in-Hand";
export const BANK_ACCOUNTS_GROUP_NAME = "Bank Accounts";
export const DIRECT_EXPENSES_GROUP_NAME = "Direct Expenses";
export const INDIRECT_EXPENSES_GROUP_NAME = "Indirect Expenses";
export const DIRECT_INCOMES_GROUP_NAME = "Direct Incomes";
export const INDIRECT_INCOMES_GROUP_NAME = "Indirect Incomes";

// The standard Tally-class Indian-accounting chart-of-accounts skeleton every
// company is seeded with — see 13-ledger-groups.md's Default Group Seeding
// table. Every `parent` here references a top-level (parent: null) group's
// `name`, so a single two-pass insert (parents, then children) is always
// enough — never a deeper hierarchy.
export const DEFAULT_LEDGER_GROUPS: readonly DefaultLedgerGroupSeed[] = [
  { name: "Capital Account", parent: null, nature: "LIABILITY", affectsGrossProfit: false },
  { name: "Reserves & Surplus", parent: null, nature: "LIABILITY", affectsGrossProfit: false },
  { name: "Loans (Liability)", parent: null, nature: "LIABILITY", affectsGrossProfit: false },
  { name: "Secured Loans", parent: "Loans (Liability)", nature: "LIABILITY", affectsGrossProfit: false },
  { name: "Unsecured Loans", parent: "Loans (Liability)", nature: "LIABILITY", affectsGrossProfit: false },
  { name: "Current Liabilities", parent: null, nature: "LIABILITY", affectsGrossProfit: false },
  { name: "Sundry Creditors", parent: "Current Liabilities", nature: "LIABILITY", affectsGrossProfit: false },
  { name: "Duties & Taxes", parent: "Current Liabilities", nature: "LIABILITY", affectsGrossProfit: false },
  { name: "Provisions", parent: "Current Liabilities", nature: "LIABILITY", affectsGrossProfit: false },
  { name: "Fixed Assets", parent: null, nature: "ASSET", affectsGrossProfit: false },
  { name: "Investments", parent: null, nature: "ASSET", affectsGrossProfit: false },
  { name: "Current Assets", parent: null, nature: "ASSET", affectsGrossProfit: false },
  { name: BANK_ACCOUNTS_GROUP_NAME, parent: "Current Assets", nature: "ASSET", affectsGrossProfit: false },
  { name: CASH_IN_HAND_GROUP_NAME, parent: "Current Assets", nature: "ASSET", affectsGrossProfit: false },
  { name: "Sundry Debtors", parent: "Current Assets", nature: "ASSET", affectsGrossProfit: false },
  { name: "Loans & Advances (Asset)", parent: "Current Assets", nature: "ASSET", affectsGrossProfit: false },
  { name: "Misc. Expenses (Asset)", parent: null, nature: "ASSET", affectsGrossProfit: false },
  { name: "Sales Accounts", parent: null, nature: "INCOME", affectsGrossProfit: true },
  { name: DIRECT_INCOMES_GROUP_NAME, parent: null, nature: "INCOME", affectsGrossProfit: true },
  { name: INDIRECT_INCOMES_GROUP_NAME, parent: null, nature: "INCOME", affectsGrossProfit: false },
  { name: "Purchase Accounts", parent: null, nature: "EXPENSE", affectsGrossProfit: true },
  { name: DIRECT_EXPENSES_GROUP_NAME, parent: null, nature: "EXPENSE", affectsGrossProfit: true },
  { name: INDIRECT_EXPENSES_GROUP_NAME, parent: null, nature: "EXPENSE", affectsGrossProfit: false },
];
