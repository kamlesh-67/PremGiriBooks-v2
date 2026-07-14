import type { LedgerGroup } from "@/types/ledger-group";

/**
 * Returns the ids of every group in `groups` whose name is in `rootNames`,
 * plus every one of their descendants. Iterates to a fixed point rather than
 * assuming a fixed depth, so it stays correct even if the chart of accounts
 * ever nests deeper than 13-ledger-groups.md's current two-level seed data.
 *
 * Returns an empty set when none of `rootNames` is present in `groups` —
 * deliberately fail-open, not fail-loud: a company created before a default
 * group existed in the seed data (or whose chart of accounts simply doesn't
 * have it) has no such subtree, so there is nothing to match. See
 * excluded-groups.ts for the full history of why throwing here once broke
 * the Create Ledger screen for every pre-existing company.
 */
export function getGroupSubtreeIds(
  groups: LedgerGroup[],
  rootNames: readonly string[]
): Set<string> {
  const subtreeIds = new Set<string>();
  for (const group of groups) {
    if (rootNames.includes(group.name)) {
      subtreeIds.add(group.id);
    }
  }
  if (subtreeIds.size === 0) {
    return subtreeIds;
  }

  let changed = true;
  while (changed) {
    changed = false;
    for (const group of groups) {
      if (group.parentGroupId && subtreeIds.has(group.parentGroupId) && !subtreeIds.has(group.id)) {
        subtreeIds.add(group.id);
        changed = true;
      }
    }
  }

  return subtreeIds;
}
