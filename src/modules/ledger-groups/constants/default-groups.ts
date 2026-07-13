import type { AccountNature } from "@prisma/client";

export interface DefaultLedgerGroupSeed {
  name: string;
  parent: string | null;
  nature: AccountNature;
  affectsGrossProfit: boolean;
}

// The standard Tally-class Indian-accounting chart-of-accounts skeleton every
// company is seeded with — see 13-ledger-groups.md's Default Group Seeding
// table. Every `parent` here references a top-level (parent: null) group's
// `name`, so a single two-pass insert (parents, then children) is always
// enough — never a deeper hierarchy.
export const DEFAULT_LEDGER_GROUPS: DefaultLedgerGroupSeed[] = [
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
  { name: "Bank Accounts", parent: "Current Assets", nature: "ASSET", affectsGrossProfit: false },
  { name: "Cash-in-Hand", parent: "Current Assets", nature: "ASSET", affectsGrossProfit: false },
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
