import { describe, expect, it } from "vitest";

import { getBankAccountsSubtreeIds } from "@/modules/ledgers/utils/excluded-groups";
import { getExpenseHeadGroupIds } from "@/modules/ledgers/utils/expense-head-groups";
import { getIncomeHeadGroupIds } from "@/modules/ledgers/utils/income-head-groups";
import { getGroupSubtreeIds } from "@/modules/ledgers/utils/group-subtree";
import type { LedgerGroup } from "@/types/ledger-group";

function makeGroup(id: string, name: string, parentGroupId: string | null): LedgerGroup {
  return {
    id,
    companyId: "company-1",
    name,
    parentGroupId,
    natureType: "EXPENSE",
    affectsGrossProfit: false,
    isSystemDefined: true,
    isActive: true,
    remarks: null,
    createdAt: new Date(0),
    updatedAt: new Date(0),
  };
}

describe("getGroupSubtreeIds", () => {
  it("returns an empty set when no root name is present (fail-open for legacy companies)", () => {
    const groups = [makeGroup("g1", "Fixed Assets", null)];
    expect(getGroupSubtreeIds(groups, ["Direct Expenses"]).size).toBe(0);
  });

  it("collects multiple roots and their descendants across arbitrary depth", () => {
    const groups = [
      makeGroup("direct", "Direct Expenses", null),
      makeGroup("indirect", "Indirect Expenses", null),
      makeGroup("factory", "Factory Expenses", "direct"),
      // Deliberately listed before its parent to exercise the fixed-point
      // iteration (a single forward pass would miss it).
      makeGroup("machine", "Machine Upkeep", "factory-2"),
      makeGroup("factory-2", "Factory Sub", "factory"),
      makeGroup("office", "Office Expenses", "indirect"),
      makeGroup("unrelated", "Sales Accounts", null),
    ];

    const ids = getGroupSubtreeIds(groups, ["Direct Expenses", "Indirect Expenses"]);
    expect(ids).toEqual(new Set(["direct", "indirect", "factory", "factory-2", "machine", "office"]));
  });
});

describe("getExpenseHeadGroupIds", () => {
  it('never includes "Purchase Accounts" even though its nature is also EXPENSE', () => {
    const groups = [
      makeGroup("direct", "Direct Expenses", null),
      makeGroup("purchase", "Purchase Accounts", null),
      makeGroup("purchase-child", "Import Purchases", "purchase"),
    ];

    const ids = getExpenseHeadGroupIds(groups);
    expect(ids.has("direct")).toBe(true);
    expect(ids.has("purchase")).toBe(false);
    expect(ids.has("purchase-child")).toBe(false);
  });
});

describe("getIncomeHeadGroupIds", () => {
  it('never includes "Sales Accounts" even though its nature is also INCOME', () => {
    const groups = [
      makeGroup("direct", "Direct Incomes", null),
      makeGroup("indirect", "Indirect Incomes", null),
      makeGroup("commission", "Commission Received", "indirect"),
      makeGroup("sales", "Sales Accounts", null),
      makeGroup("sales-child", "Export Sales", "sales"),
    ];

    const ids = getIncomeHeadGroupIds(groups);
    expect(ids).toEqual(new Set(["direct", "indirect", "commission"]));
  });
});

describe("getBankAccountsSubtreeIds", () => {
  it("still matches the Bank Accounts subtree through the shared helper", () => {
    const groups = [
      makeGroup("current-assets", "Current Assets", null),
      makeGroup("banks", "Bank Accounts", "current-assets"),
      makeGroup("hdfc", "HDFC Accounts", "banks"),
    ];

    expect(getBankAccountsSubtreeIds(groups)).toEqual(new Set(["banks", "hdfc"]));
  });
});
