import {
  DIRECT_EXPENSES_GROUP_NAME,
  INDIRECT_EXPENSES_GROUP_NAME,
} from "@/modules/ledger-groups/constants/default-groups";
import { getGroupSubtreeIds } from "@/modules/ledgers/utils/group-subtree";
import type { LedgerGroup } from "@/types/ledger-group";

/**
 * Returns the ids of the "Direct Expenses" and "Indirect Expenses" ledger
 * groups plus every one of their descendants — the only groups an Expense
 * Head (16-expense-heads.md) may belong to. The inverse of
 * excluded-groups.ts's "Bank Accounts" usage: there the subtree is excluded
 * from a picker, here membership is required.
 *
 * "Purchase Accounts" also has natureType EXPENSE but is deliberately never
 * part of this set — it is a separate top-level group, not a descendant of
 * either root, and per the spec it is reserved for the future Purchase
 * module's trading/cost-of-goods ledgers, not operating expense heads.
 */
export function getExpenseHeadGroupIds(groups: LedgerGroup[]): Set<string> {
  return getGroupSubtreeIds(groups, [DIRECT_EXPENSES_GROUP_NAME, INDIRECT_EXPENSES_GROUP_NAME]);
}
