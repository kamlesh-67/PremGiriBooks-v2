import type { Prisma } from "@prisma/client";

import { AppError } from "@/lib/app-error";
import { getCurrentCompanyUser } from "@/lib/current-user";
import { assertPermission } from "@/lib/permissions";
import { ledgerGroupRepository } from "@/modules/ledger-groups/repositories/ledger-group-repository";
import { ledgerRepository } from "@/modules/ledgers/repositories/ledger-repository";
import { getBankAccountsSubtreeIds } from "@/modules/ledgers/utils/excluded-groups";
import { getExpenseHeadGroupIds } from "@/modules/ledgers/utils/expense-head-groups";
import { getIncomeHeadGroupIds } from "@/modules/ledgers/utils/income-head-groups";
import { isUniqueConstraintError } from "@/lib/prisma-errors";
import {
  createLedgerSchema,
  updateLedgerSchema,
  type CreateLedgerInput,
  type UpdateLedgerInput,
} from "@/modules/ledgers/validation/ledger-schema";
import type { BalanceType, Ledger, LedgerListFilters, LedgerWithGroup } from "@/types/ledger";
import type { LedgerGroup } from "@/types/ledger-group";

// The permission catalog (11-role-permissions.md) has no dedicated
// activate/deactivate action, only view/create/edit/delete/approve/export —
// Activate and Deactivate both gate on "delete", mirroring
// ledger-group-service.ts's identical reasoning.
const LIFECYCLE_ACTION = "delete";

function translatePersistError(error: unknown): never {
  if (isUniqueConstraintError(error)) {
    throw new AppError("A ledger with this name already exists in this company.");
  }
  throw error;
}

interface CreateUnderGroupInput {
  name: string;
  openingBalance: number;
  openingBalanceType: BalanceType;
  description?: string | null;
  isSystemDefined?: boolean;
}

// Module-level so both createUnderGroup (the raw primitive other services
// compose into their own transactions) and createExpenseHead (which adds the
// expense-subtree validation first) share one write path without the service
// object referencing itself in its own initializer.
function createLedgerUnderGroup(
  companyId: string,
  groupId: string,
  input: CreateUnderGroupInput,
  tx?: Prisma.TransactionClient
): Promise<Ledger> {
  return ledgerRepository.create(
    companyId,
    {
      name: input.name,
      ledgerGroupId: groupId,
      openingBalance: input.openingBalance,
      openingBalanceType: input.openingBalanceType,
      description: input.description ?? null,
      isSystemDefined: input.isSystemDefined ?? false,
    },
    tx
  );
}

export const ledgerService = {
  async listLedgers(filters: LedgerListFilters = {}): Promise<LedgerWithGroup[]> {
    const user = await getCurrentCompanyUser();
    await assertPermission(user, "accounting", "view");
    return ledgerRepository.findMany(user.companyId, filters);
  },

  // A ledger belonging to a different company must resolve identically to
  // "not found" — never distinguish "exists but isn't yours" from "doesn't
  // exist," mirroring ledger-group-service.ts's identical rule.
  async getLedger(id: string): Promise<LedgerWithGroup | null> {
    const user = await getCurrentCompanyUser();
    await assertPermission(user, "accounting", "view");

    const ledger = await ledgerRepository.findById(id);
    if (!ledger || ledger.companyId !== user.companyId) {
      return null;
    }
    return ledger;
  },

  /** Active ledgers for the current company, consumed by the Ledger Selector. */
  async listSelectableLedgers(
    filters: Omit<LedgerListFilters, "status"> = {}
  ): Promise<LedgerWithGroup[]> {
    const user = await getCurrentCompanyUser();
    await assertPermission(user, "accounting", "view");
    return ledgerRepository.findMany(user.companyId, { ...filters, status: "active" });
  },

  /** Active, non-"Bank Accounts" groups for the generic Create Ledger screen's Group selector. */
  async listSelectableLedgerGroupsForLedger(): Promise<LedgerGroup[]> {
    const user = await getCurrentCompanyUser();
    await assertPermission(user, "accounting", "view");

    const groups = await ledgerGroupRepository.findMany(user.companyId, { status: "active" });
    const excludedIds = getBankAccountsSubtreeIds(groups);
    return groups.filter((group) => !excludedIds.has(group.id));
  },

  async createLedger(input: CreateLedgerInput): Promise<Ledger> {
    const user = await getCurrentCompanyUser();
    await assertPermission(user, "accounting", "create");

    const data = createLedgerSchema.parse(input);

    const [group, allGroups] = await Promise.all([
      ledgerGroupRepository.findById(data.ledgerGroupId),
      ledgerGroupRepository.findMany(user.companyId, {}),
    ]);
    if (!group || group.companyId !== user.companyId) {
      throw new AppError("Ledger group not found.");
    }
    if (!group.isActive) {
      throw new AppError("Cannot create a ledger under an inactive ledger group.");
    }
    if (getBankAccountsSubtreeIds(allGroups).has(group.id)) {
      throw new AppError(
        'Ledgers under "Bank Accounts" can only be created through Bank Management.'
      );
    }

    try {
      return await ledgerRepository.create(user.companyId, {
        name: data.name,
        ledgerGroupId: data.ledgerGroupId,
        openingBalance: data.openingBalance,
        openingBalanceType: data.openingBalanceType,
        description: data.description ?? null,
        isSystemDefined: false,
      });
    } catch (error) {
      translatePersistError(error);
    }
  },

  async updateLedger(id: string, input: UpdateLedgerInput): Promise<Ledger> {
    const user = await getCurrentCompanyUser();
    await assertPermission(user, "accounting", "edit");

    const data = updateLedgerSchema.parse(input);

    try {
      const ledger = await ledgerRepository.update(id, user.companyId, {
        name: data.name,
        openingBalance: data.openingBalance,
        openingBalanceType: data.openingBalanceType,
        description: data.description ?? null,
      });
      if (!ledger) {
        throw new AppError("Ledger not found.");
      }
      return ledger;
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      translatePersistError(error);
    }
  },

  async activateLedger(id: string): Promise<Ledger> {
    const user = await getCurrentCompanyUser();
    await assertPermission(user, "accounting", LIFECYCLE_ACTION);

    const result = await ledgerRepository.activate(id, user.companyId);
    switch (result.status) {
      case "not_found":
        throw new AppError("Ledger not found.");
      case "ok":
        return result.ledger;
    }
  },

  async deactivateLedger(id: string): Promise<Ledger> {
    const user = await getCurrentCompanyUser();
    await assertPermission(user, "accounting", LIFECYCLE_ACTION);

    const result = await ledgerRepository.deactivate(id, user.companyId);
    switch (result.status) {
      case "not_found":
        throw new AppError("Ledger not found.");
      case "system_defined":
        throw new AppError('The system-defined "Cash" ledger cannot be deactivated.');
      case "ok":
        return result.ledger;
    }
  },

  /**
   * Called from companyService.createCompany() inside its own transaction,
   * immediately after 13-ledger-groups.md's seedDefaultGroups() — no
   * permission check here, mirroring ledgerGroupService.seedDefaultGroups()'s
   * identical reasoning (company creation is already gated by the caller).
   */
  seedDefaultLedger(companyId: string, tx: Prisma.TransactionClient): Promise<void> {
    return ledgerRepository.seedDefault(companyId, tx);
  },

  /**
   * Primitive for other services (15-bank-management.md today) that have
   * already resolved and validated their own ledgerGroupId — skips the
   * generic Create Ledger screen's permission check and "Bank Accounts"
   * exclusion, since the caller is itself an already-permission-gated
   * service composing this as one step of its own atomic operation (e.g. a
   * Ledger and a BankAccount row created together in one transaction).
   * createExpenseHead/createIncomeHead below share the same write path via
   * the module-level createLedgerUnderGroup helper.
   */
  createUnderGroup(
    companyId: string,
    groupId: string,
    input: CreateUnderGroupInput,
    tx?: Prisma.TransactionClient
  ): Promise<Ledger> {
    return createLedgerUnderGroup(companyId, groupId, input, tx);
  },

  // ——— Expense Heads (16-expense-heads.md) ———
  // An Expense Head is not a new entity — it is a Ledger whose group is
  // "Direct Expenses"/"Indirect Expenses" or a descendant of either. These
  // methods are the scoped query/create layer that spec adds on top of the
  // generic Ledger operations above; Edit/Activate/Deactivate reuse
  // updateLedger/activateLedger/deactivateLedger unchanged.

  /**
   * Ledgers under "Direct Expenses"/"Indirect Expenses" (or any descendant).
   * Group membership is computed over ALL groups (not just active ones) so an
   * existing expense head still lists after its group is deactivated.
   */
  async listExpenseHeads(filters: LedgerListFilters = {}): Promise<LedgerWithGroup[]> {
    const user = await getCurrentCompanyUser();
    await assertPermission(user, "accounting", "view");

    const groups = await ledgerGroupRepository.findMany(user.companyId, {});
    const expenseGroupIds = getExpenseHeadGroupIds(groups);
    if (expenseGroupIds.size === 0) {
      return [];
    }

    const ledgers = await ledgerRepository.findMany(user.companyId, filters);
    return ledgers.filter((ledger) => expenseGroupIds.has(ledger.ledgerGroupId));
  },

  /**
   * Like getLedger, but additionally resolves to null when the ledger is not
   * an expense head — the Expense Heads edit page must not open an arbitrary
   * ledger (e.g. a bank ledger) just because the id was pasted into its URL.
   */
  async getExpenseHead(id: string): Promise<LedgerWithGroup | null> {
    const user = await getCurrentCompanyUser();
    await assertPermission(user, "accounting", "view");

    const ledger = await ledgerRepository.findById(id);
    if (!ledger || ledger.companyId !== user.companyId) {
      return null;
    }

    const groups = await ledgerGroupRepository.findMany(user.companyId, {});
    if (!getExpenseHeadGroupIds(groups).has(ledger.ledgerGroupId)) {
      return null;
    }
    return ledger;
  },

  /**
   * Active groups within the "Direct Expenses"/"Indirect Expenses" subtrees,
   * for the Expense Head form's Group selector. Computing the subtree over
   * active groups only is safe: a group with any active child cannot be
   * deactivated (13-ledger-groups.md), so an active descendant can never be
   * orphaned from its root by an inactive intermediate parent.
   */
  async listSelectableLedgerGroupsForExpenseHead(): Promise<LedgerGroup[]> {
    const user = await getCurrentCompanyUser();
    await assertPermission(user, "accounting", "view");

    const groups = await ledgerGroupRepository.findMany(user.companyId, { status: "active" });
    const expenseGroupIds = getExpenseHeadGroupIds(groups);
    return groups.filter((group) => expenseGroupIds.has(group.id));
  },

  /**
   * Thin wrapper over the createUnderGroup primitive that first validates the
   * chosen group is an active, same-company member of the expense subtree —
   * re-derived server-side from a fresh company-scoped group list, never
   * trusting the client-filtered picker (mirrors createLedger's "Bank
   * Accounts" check, inverted). A cross-company groupId can never appear in
   * the company-scoped subtree set, so it is rejected before the write.
   */
  async createExpenseHead(input: CreateLedgerInput): Promise<Ledger> {
    const user = await getCurrentCompanyUser();
    await assertPermission(user, "accounting", "create");

    const data = createLedgerSchema.parse(input);

    const [group, allGroups] = await Promise.all([
      ledgerGroupRepository.findById(data.ledgerGroupId),
      ledgerGroupRepository.findMany(user.companyId, {}),
    ]);
    if (!group || group.companyId !== user.companyId) {
      throw new AppError("Ledger group not found.");
    }
    if (!group.isActive) {
      throw new AppError("Cannot create an expense head under an inactive ledger group.");
    }
    if (!getExpenseHeadGroupIds(allGroups).has(group.id)) {
      throw new AppError(
        'An expense head must belong to "Direct Expenses" or "Indirect Expenses", or one of their sub-groups.'
      );
    }

    try {
      return await createLedgerUnderGroup(user.companyId, group.id, {
        name: data.name,
        openingBalance: data.openingBalance,
        openingBalanceType: data.openingBalanceType,
        description: data.description ?? null,
      });
    } catch (error) {
      translatePersistError(error);
    }
  },

  // ——— Income Heads (17-income-heads.md) ———
  // The income-side mirror of the Expense Heads layer above: an Income Head
  // is a Ledger whose group is "Direct Incomes"/"Indirect Incomes" or a
  // descendant of either ("Sales Accounts" deliberately excluded — reserved
  // for the future Sales module). Edit/Activate/Deactivate reuse
  // updateLedger/activateLedger/deactivateLedger unchanged.

  /**
   * Ledgers under "Direct Incomes"/"Indirect Incomes" (or any descendant).
   * Group membership is computed over ALL groups (not just active ones) so an
   * existing income head still lists after its group is deactivated.
   */
  async listIncomeHeads(filters: LedgerListFilters = {}): Promise<LedgerWithGroup[]> {
    const user = await getCurrentCompanyUser();
    await assertPermission(user, "accounting", "view");

    const groups = await ledgerGroupRepository.findMany(user.companyId, {});
    const incomeGroupIds = getIncomeHeadGroupIds(groups);
    if (incomeGroupIds.size === 0) {
      return [];
    }

    const ledgers = await ledgerRepository.findMany(user.companyId, filters);
    return ledgers.filter((ledger) => incomeGroupIds.has(ledger.ledgerGroupId));
  },

  /**
   * Like getLedger, but additionally resolves to null when the ledger is not
   * an income head — the Income Heads edit page must not open an arbitrary
   * ledger (e.g. a bank or sales ledger) just because the id was pasted into
   * its URL.
   */
  async getIncomeHead(id: string): Promise<LedgerWithGroup | null> {
    const user = await getCurrentCompanyUser();
    await assertPermission(user, "accounting", "view");

    const ledger = await ledgerRepository.findById(id);
    if (!ledger || ledger.companyId !== user.companyId) {
      return null;
    }

    const groups = await ledgerGroupRepository.findMany(user.companyId, {});
    if (!getIncomeHeadGroupIds(groups).has(ledger.ledgerGroupId)) {
      return null;
    }
    return ledger;
  },

  /**
   * Active groups within the "Direct Incomes"/"Indirect Incomes" subtrees,
   * for the Income Head form's Group selector. Computing the subtree over
   * active groups only is safe: a group with any active child cannot be
   * deactivated (13-ledger-groups.md), so an active descendant can never be
   * orphaned from its root by an inactive intermediate parent.
   */
  async listSelectableLedgerGroupsForIncomeHead(): Promise<LedgerGroup[]> {
    const user = await getCurrentCompanyUser();
    await assertPermission(user, "accounting", "view");

    const groups = await ledgerGroupRepository.findMany(user.companyId, { status: "active" });
    const incomeGroupIds = getIncomeHeadGroupIds(groups);
    return groups.filter((group) => incomeGroupIds.has(group.id));
  },

  /**
   * Thin wrapper over the createUnderGroup primitive that first validates the
   * chosen group is an active, same-company member of the income subtree —
   * re-derived server-side from a fresh company-scoped group list, never
   * trusting the client-filtered picker (mirrors createExpenseHead exactly).
   * A cross-company groupId can never appear in the company-scoped subtree
   * set, so it is rejected before the write.
   */
  async createIncomeHead(input: CreateLedgerInput): Promise<Ledger> {
    const user = await getCurrentCompanyUser();
    await assertPermission(user, "accounting", "create");

    const data = createLedgerSchema.parse(input);

    const [group, allGroups] = await Promise.all([
      ledgerGroupRepository.findById(data.ledgerGroupId),
      ledgerGroupRepository.findMany(user.companyId, {}),
    ]);
    if (!group || group.companyId !== user.companyId) {
      throw new AppError("Ledger group not found.");
    }
    if (!group.isActive) {
      throw new AppError("Cannot create an income head under an inactive ledger group.");
    }
    if (!getIncomeHeadGroupIds(allGroups).has(group.id)) {
      throw new AppError(
        'An income head must belong to "Direct Incomes" or "Indirect Incomes", or one of their sub-groups.'
      );
    }

    try {
      return await createLedgerUnderGroup(user.companyId, group.id, {
        name: data.name,
        openingBalance: data.openingBalance,
        openingBalanceType: data.openingBalanceType,
        description: data.description ?? null,
      });
    } catch (error) {
      translatePersistError(error);
    }
  },
};
