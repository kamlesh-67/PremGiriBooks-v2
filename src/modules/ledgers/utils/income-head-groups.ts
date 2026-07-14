import {
  DIRECT_INCOMES_GROUP_NAME,
  INDIRECT_INCOMES_GROUP_NAME,
} from "@/modules/ledger-groups/constants/default-groups";
import { getGroupSubtreeIds } from "@/modules/ledgers/utils/group-subtree";
import type { LedgerGroup } from "@/types/ledger-group";

/**
 * Returns the ids of the "Direct Incomes" and "Indirect Incomes" ledger
 * groups plus every one of their descendants — the only groups an Income
 * Head (17-income-heads.md) may belong to. The income-side mirror of
 * expense-head-groups.ts.
 *
 * "Sales Accounts" also has natureType INCOME (and affectsGrossProfit) but
 * is deliberately never part of this set — it is a separate top-level group,
 * not a descendant of either root, and per the spec it is reserved for the
 * future Sales module's trading/sales revenue ledgers, not income heads.
 */
export function getIncomeHeadGroupIds(groups: LedgerGroup[]): Set<string> {
  return getGroupSubtreeIds(groups, [DIRECT_INCOMES_GROUP_NAME, INDIRECT_INCOMES_GROUP_NAME]);
}
