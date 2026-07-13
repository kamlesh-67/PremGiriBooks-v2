import type { Prisma } from "@prisma/client";

import { AppError } from "@/lib/app-error";
import { getCurrentUser } from "@/lib/current-user";
import { assertPermission } from "@/lib/permissions";
import { ledgerGroupRepository } from "@/modules/ledger-groups/repositories/ledger-group-repository";
import { ledgerRepository } from "@/modules/ledgers/repositories/ledger-repository";
import { getBankAccountsSubtreeIds } from "@/modules/ledgers/utils/excluded-groups";
import { isUniqueConstraintError } from "@/modules/ledgers/utils/prisma-errors";
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

export const ledgerService = {
  async listLedgers(filters: LedgerListFilters = {}): Promise<LedgerWithGroup[]> {
    const user = await getCurrentUser();
    await assertPermission(user, "accounting", "view");
    return ledgerRepository.findMany(user.companyId, filters);
  },

  // A ledger belonging to a different company must resolve identically to
  // "not found" — never distinguish "exists but isn't yours" from "doesn't
  // exist," mirroring ledger-group-service.ts's identical rule.
  async getLedger(id: string): Promise<LedgerWithGroup | null> {
    const user = await getCurrentUser();
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
    const user = await getCurrentUser();
    await assertPermission(user, "accounting", "view");
    return ledgerRepository.findMany(user.companyId, { ...filters, status: "active" });
  },

  /** Active, non-"Bank Accounts" groups for the generic Create Ledger screen's Group selector. */
  async listSelectableLedgerGroupsForLedger(): Promise<LedgerGroup[]> {
    const user = await getCurrentUser();
    await assertPermission(user, "accounting", "view");

    const groups = await ledgerGroupRepository.findMany(user.companyId, { status: "active" });
    const excludedIds = getBankAccountsSubtreeIds(groups);
    return groups.filter((group) => !excludedIds.has(group.id));
  },

  async createLedger(input: CreateLedgerInput): Promise<Ledger> {
    const user = await getCurrentUser();
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
    const user = await getCurrentUser();
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
    const user = await getCurrentUser();
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
    const user = await getCurrentUser();
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
   * Primitive used by future modules (15-bank-management.md,
   * 16-expense-heads.md, 17-income-heads.md) that have already resolved and
   * validated their own ledgerGroupId — skips the generic Create Ledger
   * screen's permission check and "Bank Accounts" exclusion, since the
   * caller is itself an already-permission-gated service composing this as
   * one step of its own atomic operation (e.g. a Ledger and a BankAccount
   * row created together in one transaction).
   */
  createUnderGroup(
    companyId: string,
    groupId: string,
    input: {
      name: string;
      openingBalance: number;
      openingBalanceType: BalanceType;
      description?: string | null;
      isSystemDefined?: boolean;
    },
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
  },
};
