import type { AccountNature } from "@prisma/client";

export interface DefaultLedgerGroupSeed {
  readonly name: string;
  readonly parent: string | null;
  readonly nature: AccountNature;
  readonly affectsGrossProfit: boolean;
}

// Named so other modules that must look up a specific default group by name
// (14-ledger-master.md's "Cash" seeding under Cash-in-Hand, and its "Bank
// Accounts" subtree exclusion) reference one shared constant instead of
// re-typing the literal — a typo or rename here now fails those lookups
// loudly (AppError) rather than silently, since both call sites throw when
// the name doesn't resolve to an existing group.
export const CASH_IN_HAND_GROUP_NAME = "Cash-in-Hand";
export const BANK_ACCOUNTS_GROUP_NAME = "Bank Accounts";

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
  { name: "Direct Incomes", parent: null, nature: "INCOME", affectsGrossProfit: true },
  { name: "Indirect Incomes", parent: null, nature: "INCOME", affectsGrossProfit: false },
  { name: "Purchase Accounts", parent: null, nature: "EXPENSE", affectsGrossProfit: true },
  { name: "Direct Expenses", parent: null, nature: "EXPENSE", affectsGrossProfit: true },
  { name: "Indirect Expenses", parent: null, nature: "EXPENSE", affectsGrossProfit: false },
];
