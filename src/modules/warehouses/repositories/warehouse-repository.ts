import { Prisma } from "@prisma/client";

import { AppError } from "@/lib/app-error";
import { prisma } from "@/lib/prisma";
import { runInTransaction } from "@/lib/transaction";
import { isRecordNotFoundError, isRetryableTransactionError } from "@/lib/prisma-errors";
import type {
  ActivateWarehouseResult,
  DeactivateWarehouseResult,
  SetDefaultWarehouseResult,
  UnsetDefaultWarehouseResult,
  Warehouse,
  WarehouseBranchOption,
  WarehouseListFilters,
  WarehouseWithBranch,
} from "@/types/warehouse";

export const BRANCH_NOT_FOUND_MESSAGE = "Selected branch was not found.";
export const BRANCH_INACTIVE_MESSAGE = "Selected branch is inactive.";

export interface WarehousePersistData {
  name: string;
  code: string;
  branchId: string | null;
  address: string | null;
  contactNumber: string | null;
}

// The one-default-per-company invariant is service-enforced, not a DB
// constraint (Prisma cannot express a partial unique index portably), so the
// set-default / unset-default / deactivate read-check-write paths run under
// Serializable isolation with bounded retry — the same recipe as
// financial-year-repository.ts's "only one current flag". Plain Read
// Committed is not enough: two concurrent set-default calls would each clear
// the *other's* flag and set their own; Serializable makes Postgres abort
// one with P2034, the retry re-runs it, and the invariant holds (last
// committed write wins). Uses the shared P2034-only classifier — Warehouse
// has no hand-written partial unique index, so P2002 here is always a
// genuine uniqueness violation, never a transient conflict.
const SERIALIZABLE_RETRY = {
  isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
  retryable: isRetryableTransactionError,
  conflictMessage: "The warehouse was changed by another request. Please try again.",
};

const BRANCH_OPTION_SELECT = { id: true, branchName: true, isActive: true } as const;

/**
 * A supplied branch must belong to the same company and be active at
 * assignment time — server-verified, never trusted from the client
 * (24-warehouse-management.md). A cross-company branch reports the same
 * message as a nonexistent one. Runs inside the caller's transaction so the
 * check and the write see the same snapshot.
 */
async function assertAssignableBranch(
  tx: Prisma.TransactionClient,
  companyId: string,
  branchId: string
): Promise<void> {
  const branch = await tx.branch.findUnique({ where: { id: branchId } });
  if (!branch || branch.companyId !== companyId) {
    throw new AppError(BRANCH_NOT_FOUND_MESSAGE);
  }
  if (!branch.isActive) {
    throw new AppError(BRANCH_INACTIVE_MESSAGE);
  }
}

function buildWhere(companyId: string, filters: WarehouseListFilters): Prisma.WarehouseWhereInput {
  const where: Prisma.WarehouseWhereInput = { companyId };

  if (filters.status === "active") {
    where.isActive = true;
  } else if (filters.status === "inactive") {
    where.isActive = false;
  }

  if (filters.search) {
    // Search covers name + code, mirroring Unit's name/symbol pairing.
    where.OR = [
      { name: { contains: filters.search, mode: "insensitive" } },
      { code: { contains: filters.search, mode: "insensitive" } },
    ];
  }

  return where;
}

export const warehouseRepository = {
  async findMany(
    companyId: string,
    filters: WarehouseListFilters = {}
  ): Promise<WarehouseWithBranch[]> {
    return prisma.warehouse.findMany({
      where: buildWhere(companyId, filters),
      include: { branch: { select: BRANCH_OPTION_SELECT } },
      orderBy: { name: "asc" },
    });
  },

  async findById(id: string): Promise<Warehouse | null> {
    return prisma.warehouse.findUnique({ where: { id } });
  },

  /**
   * Active branches of the company — the branch picker's options. When
   * `includeBranchId` names a same-company branch that is inactive (an edited
   * warehouse's current, since-deactivated branch), it is included anyway so
   * the stored value stays visible and re-selectable, mirroring the category
   * parent picker's identical convention. Until Branch Management is
   * implemented this list is simply empty — a valid, fully-supported state.
   */
  async findSelectableBranches(
    companyId: string,
    includeBranchId?: string
  ): Promise<WarehouseBranchOption[]> {
    const or: Prisma.BranchWhereInput[] = [{ isActive: true }];
    if (includeBranchId) {
      or.push({ id: includeBranchId });
    }
    return prisma.branch.findMany({
      where: { companyId, OR: or },
      select: BRANCH_OPTION_SELECT,
      orderBy: { branchName: "asc" },
    });
  },

  // No Serializable isolation on create — there is no one-default invariant
  // to guard (a new warehouse is never default) and the branch
  // active-at-assignment check has no invariant behind it (a branch later
  // deactivated does not cascade to its warehouses, so a concurrent branch
  // deactivation slipping past the check breaks nothing).
  async create(companyId: string, data: WarehousePersistData): Promise<Warehouse> {
    return runInTransaction(async (tx) => {
      if (data.branchId) {
        await assertAssignableBranch(tx, companyId, data.branchId);
      }
      return tx.warehouse.create({ data: { ...data, companyId } });
    });
  },

  // Plain update never touches isDefault (excluded at the validation layer),
  // so only the ordinary scoped transaction is needed. The branch
  // active-at-assignment check applies only when the branch is actually
  // reassigned — otherwise renaming a warehouse under a since-deactivated
  // branch would be impossible (the category module's identical
  // unchanged-parent rule).
  async update(
    id: string,
    companyId: string,
    data: WarehousePersistData
  ): Promise<Warehouse | null> {
    return runInTransaction(async (tx) => {
      const existing = await tx.warehouse.findUnique({ where: { id } });
      if (!existing || existing.companyId !== companyId) {
        return null;
      }

      if (data.branchId && data.branchId !== existing.branchId) {
        await assertAssignableBranch(tx, companyId, data.branchId);
      }

      try {
        return await tx.warehouse.update({ where: { id }, data });
      } catch (error) {
        if (isRecordNotFoundError(error)) {
          return null;
        }
        throw error;
      }
    });
  },

  async activate(id: string, companyId: string): Promise<ActivateWarehouseResult> {
    return runInTransaction(async (tx) => {
      const existing = await tx.warehouse.findUnique({ where: { id } });
      if (!existing || existing.companyId !== companyId) {
        return { status: "not_found" };
      }

      const warehouse = await tx.warehouse.update({ where: { id }, data: { isActive: true } });
      return { status: "ok", warehouse };
    });
  },

  /**
   * Deactivating the default warehouse clears its isDefault flag in the same
   * transaction — an inactive warehouse must never remain the default, and a
   * company may validly have no default. Serializable + retry because a
   * concurrent set-default targeting the same warehouse is the race
   * (24-warehouse-management.md's Business Rules).
   */
  async deactivate(id: string, companyId: string): Promise<DeactivateWarehouseResult> {
    return runInTransaction(async (tx) => {
      const existing = await tx.warehouse.findUnique({ where: { id } });
      if (!existing || existing.companyId !== companyId) {
        return { status: "not_found" };
      }

      const warehouse = await tx.warehouse.update({
        where: { id },
        data: { isActive: false, isDefault: false },
      });
      return { status: "ok", warehouse };
    }, SERIALIZABLE_RETRY);
  },

  /**
   * Sets the one-default flag: clears it from any other warehouse of the
   * company and sets it on the target inside a single Serializable
   * transaction (see SERIALIZABLE_RETRY above). Only an active warehouse can
   * be made default.
   */
  async setDefault(id: string, companyId: string): Promise<SetDefaultWarehouseResult> {
    return runInTransaction(async (tx) => {
      const existing = await tx.warehouse.findUnique({ where: { id } });
      if (!existing || existing.companyId !== companyId) {
        return { status: "not_found" };
      }
      if (!existing.isActive) {
        return { status: "inactive" };
      }

      await tx.warehouse.updateMany({
        where: { companyId, isDefault: true, id: { not: id } },
        data: { isDefault: false },
      });
      const warehouse = await tx.warehouse.update({ where: { id }, data: { isDefault: true } });
      return { status: "ok", warehouse };
    }, SERIALIZABLE_RETRY);
  },

  // Idempotent — unsetting a warehouse that is not the default is a no-op
  // write, not an error. Same Serializable protection: the race is a
  // concurrent set-default on the same row.
  async unsetDefault(id: string, companyId: string): Promise<UnsetDefaultWarehouseResult> {
    return runInTransaction(async (tx) => {
      const existing = await tx.warehouse.findUnique({ where: { id } });
      if (!existing || existing.companyId !== companyId) {
        return { status: "not_found" };
      }

      const warehouse = await tx.warehouse.update({ where: { id }, data: { isDefault: false } });
      return { status: "ok", warehouse };
    }, SERIALIZABLE_RETRY);
  },
};
