import type { Prisma } from "@prisma/client";

import { AppError } from "@/lib/app-error";
import { getCurrentUser } from "@/lib/current-user";
import { assertPermission } from "@/lib/permissions";
import { ledgerGroupRepository } from "@/modules/ledger-groups/repositories/ledger-group-repository";
import { buildLedgerGroupTree } from "@/modules/ledger-groups/utils/ledger-group-tree";
import { isUniqueConstraintError } from "@/modules/ledger-groups/utils/prisma-errors";
import {
  createLedgerGroupSchema,
  updateLedgerGroupSchema,
  type CreateLedgerGroupInput,
  type UpdateLedgerGroupInput,
} from "@/modules/ledger-groups/validation/ledger-group-schema";
import type {
  AccountNature,
  LedgerGroup,
  LedgerGroupListFilters,
  LedgerGroupNode,
} from "@/types/ledger-group";

// The permission catalog (11-role-permissions.md) has no dedicated
// activate/deactivate action, only view/create/edit/delete/approve/export.
// Activate and Deactivate both gate on "delete" — the closest equivalent,
// since deactivation is this codebase's substitute for delete everywhere
// (ledger groups are never permanently removed).
const LIFECYCLE_ACTION = "delete";

function translatePersistError(error: unknown): never {
  if (isUniqueConstraintError(error)) {
    throw new AppError("A ledger group with this name already exists in this company.");
  }
  throw error;
}

export const ledgerGroupService = {
  async listLedgerGroups(filters: LedgerGroupListFilters = {}): Promise<LedgerGroup[]> {
    const user = await getCurrentUser();
    await assertPermission(user, "accounting", "view");
    return ledgerGroupRepository.findMany(user.companyId, filters);
  },

  async listLedgerGroupTree(filters: LedgerGroupListFilters = {}): Promise<LedgerGroupNode[]> {
    const user = await getCurrentUser();
    await assertPermission(user, "accounting", "view");
    const groups = await ledgerGroupRepository.findMany(user.companyId, filters);
    return buildLedgerGroupTree(groups);
  },

  /** Flat, active-only lookup for parent/ledger selectors, optionally filtered by nature. */
  async listSelectableLedgerGroups(nature?: AccountNature): Promise<LedgerGroup[]> {
    const user = await getCurrentUser();
    await assertPermission(user, "accounting", "view");
    return ledgerGroupRepository.findMany(user.companyId, { status: "active", nature });
  },

  // A group belonging to a different company must resolve identically to
  // "not found" — never distinguish "exists but isn't yours" from "doesn't
  // exist," mirroring user-service.ts's identical rule.
  async getLedgerGroup(id: string): Promise<LedgerGroup | null> {
    const user = await getCurrentUser();
    await assertPermission(user, "accounting", "view");

    const group = await ledgerGroupRepository.findById(id);
    if (!group || group.companyId !== user.companyId) {
      return null;
    }
    return group;
  },

  async createLedgerGroup(input: CreateLedgerGroupInput): Promise<LedgerGroup> {
    const user = await getCurrentUser();
    await assertPermission(user, "accounting", "create");

    const data = createLedgerGroupSchema.parse(input);

    let natureType: AccountNature;
    let affectsGrossProfit: boolean;

    if (data.parentGroupId) {
      const parent = await ledgerGroupRepository.findById(data.parentGroupId);
      if (!parent || parent.companyId !== user.companyId) {
        throw new AppError("Parent group not found.");
      }
      if (!parent.isActive) {
        throw new AppError("Cannot create a sub-group under an inactive parent group.");
      }
      natureType = parent.natureType;
      affectsGrossProfit = parent.affectsGrossProfit;
    } else {
      natureType = data.natureType as AccountNature;
      // Affects Gross Profit only carries meaning for INCOME/EXPENSE natures
      // — always false for ASSET/LIABILITY regardless of client input.
      affectsGrossProfit =
        (natureType === "INCOME" || natureType === "EXPENSE") && data.affectsGrossProfit === true;
    }

    try {
      return await ledgerGroupRepository.create(user.companyId, {
        name: data.name,
        parentGroupId: data.parentGroupId ?? null,
        natureType,
        affectsGrossProfit,
        remarks: data.remarks ?? null,
        isSystemDefined: false,
      });
    } catch (error) {
      translatePersistError(error);
    }
  },

  async updateLedgerGroup(id: string, input: UpdateLedgerGroupInput): Promise<LedgerGroup> {
    const user = await getCurrentUser();
    await assertPermission(user, "accounting", "edit");

    const data = updateLedgerGroupSchema.parse(input);

    try {
      const group = await ledgerGroupRepository.update(id, user.companyId, {
        name: data.name,
        remarks: data.remarks ?? null,
      });
      if (!group) {
        throw new AppError("Ledger group not found.");
      }
      return group;
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      translatePersistError(error);
    }
  },

  async activateLedgerGroup(id: string): Promise<LedgerGroup> {
    const user = await getCurrentUser();
    await assertPermission(user, "accounting", LIFECYCLE_ACTION);

    const result = await ledgerGroupRepository.activate(id, user.companyId);
    switch (result.status) {
      case "not_found":
        throw new AppError("Ledger group not found.");
      case "parent_inactive":
        throw new AppError("Cannot activate a group while its parent group is inactive.");
      case "ok":
        return result.ledgerGroup;
    }
  },

  async deactivateLedgerGroup(id: string): Promise<LedgerGroup> {
    const user = await getCurrentUser();
    await assertPermission(user, "accounting", LIFECYCLE_ACTION);

    const result = await ledgerGroupRepository.deactivate(id, user.companyId);
    switch (result.status) {
      case "not_found":
        throw new AppError("Ledger group not found.");
      case "system_defined":
        throw new AppError("System-defined groups cannot be deactivated.");
      case "has_active_children":
        throw new AppError("Cannot deactivate a group that has an active child group.");
      case "ok":
        return result.ledgerGroup;
    }
  },

  /**
   * Called from companyService.createCompany() inside its own transaction —
   * accepts that transaction client so seeding participates in the same
   * atomic unit of work (a seeding failure rolls the company creation back
   * with it). No permission check here: company creation is already gated
   * by the caller, and this seeding is an internal step of that operation,
   * not an independently-invoked ledger-group action.
   */
  seedDefaultGroups(companyId: string, tx: Prisma.TransactionClient): Promise<void> {
    return ledgerGroupRepository.seedDefaults(companyId, tx);
  },
};
