import { BANK_ACCOUNTS_GROUP_NAME } from "@/modules/ledger-groups/constants/default-groups";
import type { LedgerGroup } from "@/types/ledger-group";

/**
 * Returns the id of the "Bank Accounts" ledger group and every one of its
 * descendants, so the generic Ledger Master Create screen can exclude them
 * from its Group selector — per 14-ledger-master.md, a Ledger under
 * "Bank Accounts" may only be created through Bank Management
 * (15-bank-management.md), atomically with its BankAccount detail row.
 * Iterates to a fixed point rather than assuming a fixed depth, so it stays
 * correct even if the chart of accounts ever nests deeper than
 * 13-ledger-groups.md's current two-level seed data.
 *
 * Returns an empty set (excludes nothing) if "Bank Accounts" isn't present in
 * `groups` — deliberately fail-open here, not fail-loud: a company created
 * before this default group existed in the seed data (or any company whose
 * chart of accounts simply doesn't have it) has no "Bank Accounts" subtree to
 * protect, so there is nothing to exclude. Throwing here previously broke the
 * Create Ledger screen entirely for any such pre-existing company — a real,
 * legitimate state, not data corruption. (Seeding a *new* company's default
 * "Cash" ledger, by contrast, correctly still throws in
 * ledger-repository.ts's seedDefault — that lookup runs inside the same
 * transaction that just created "Cash-in-Hand", so its absence there really
 * would indicate a bug.)
 */
export function getBankAccountsSubtreeIds(groups: LedgerGroup[]): Set<string> {
  // "Bank Accounts" is itself a child group (of "Current Assets" in
  // 13-ledger-groups.md's default seed data), not top-level — match by name
  // alone rather than assuming any particular position in the hierarchy.
  const bankAccountsGroup = groups.find((group) => group.name === BANK_ACCOUNTS_GROUP_NAME);
  if (!bankAccountsGroup) {
    return new Set();
  }

  const excludedIds = new Set<string>([bankAccountsGroup.id]);
  let changed = true;
  while (changed) {
    changed = false;
    for (const group of groups) {
      if (group.parentGroupId && excludedIds.has(group.parentGroupId) && !excludedIds.has(group.id)) {
        excludedIds.add(group.id);
        changed = true;
      }
    }
  }

  return excludedIds;
}
