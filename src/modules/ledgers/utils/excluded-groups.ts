import {
  BANK_ACCOUNTS_GROUP_NAME,
  RESERVED_LEDGER_GROUP_NAMES,
  SUNDRY_CREDITORS_GROUP_NAME,
  SUNDRY_DEBTORS_GROUP_NAME,
} from "@/modules/ledger-groups/constants/default-groups";
import { getGroupSubtreeIds } from "@/modules/ledgers/utils/group-subtree";
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
  return getGroupSubtreeIds(groups, [BANK_ACCOUNTS_GROUP_NAME]);
}

/**
 * The "Sundry Debtors" mirror of getBankAccountsSubtreeIds — per
 * 26-customer-management.md, a Ledger under "Sundry Debtors" (or any
 * descendant) may only be created through Customer Management, atomically
 * with its Customer detail row, so the generic Create Ledger screen excludes
 * this subtree exactly as it excludes "Bank Accounts". Same deliberate
 * fail-open behavior when the group is absent (see above).
 */
export function getSundryDebtorsSubtreeIds(groups: LedgerGroup[]): Set<string> {
  return getGroupSubtreeIds(groups, [SUNDRY_DEBTORS_GROUP_NAME]);
}

/**
 * The "Sundry Creditors" mirror of getSundryDebtorsSubtreeIds — per
 * 27-supplier-management.md, a Ledger under "Sundry Creditors" (or any
 * descendant) may only be created through Supplier Management, atomically
 * with its Supplier detail row. Same deliberate fail-open behavior when the
 * group is absent (see getBankAccountsSubtreeIds above).
 */
export function getSundryCreditorsSubtreeIds(groups: LedgerGroup[]): Set<string> {
  return getGroupSubtreeIds(groups, [SUNDRY_CREDITORS_GROUP_NAME]);
}

/**
 * The union of all three reserved subtrees ("Bank Accounts", "Sundry
 * Debtors", "Sundry Creditors") — what the generic Ledger Master Create
 * screen excludes from its Group selector, now that a third reserved group
 * exists (27-supplier-management.md's instruction to consolidate what had
 * been two separate hardcoded checks into one shared constant/helper).
 * Individual modules (Bank/Customer/Supplier Management) still use their own
 * single-group getter above for their own "is this the right subtree" check.
 */
export function getReservedLedgerGroupSubtreeIds(groups: LedgerGroup[]): Set<string> {
  return getGroupSubtreeIds(groups, RESERVED_LEDGER_GROUP_NAMES);
}
