import { Prisma, type LedgerGroup } from "@prisma/client";

import { AppError } from "@/lib/app-error";
import { prisma } from "@/lib/prisma";
import { DEFAULT_LEDGER_GROUPS } from "@/modules/ledger-groups/constants/default-groups";
import { isRecordNotFoundError } from "@/modules/ledger-groups/utils/prisma-errors";
import { withRetry } from "@/modules/ledger-groups/utils/with-retry";
import type { DeactivateLedgerGroupResult, LedgerGroupListFilters } from "@/types/ledger-group";

const SERIALIZABLE = { isolationLevel: Prisma.TransactionIsolationLevel.Serializable };

export interface LedgerGroupCreateData {
  name: string;
  parentGroupId: string | null;
  natureType: LedgerGroup["natureType"];
  affectsGrossProfit: boolean;
  remarks: string | null;
  isSystemDefined: boolean;
}

export interface LedgerGroupUpdateData {
  name: string;
  remarks: string | null;
}

function buildWhere(companyId: string, filters: LedgerGroupListFilters): Prisma.LedgerGroupWhereInput {
  const where: Prisma.LedgerGroupWhereInput = { companyId };

  if (filters.status === "active") {
    where.isActive = true;
  } else if (filters.status === "inactive") {
    where.isActive = false;
  }

  if (filters.nature) {
    where.natureType = filters.nature;
  }

  if (filters.search) {
    where.name = { contains: filters.search, mode: "insensitive" };
  }

  return where;
}

export const ledgerGroupRepository = {
  findMany(companyId: string, filters: LedgerGroupListFilters = {}): Promise<LedgerGroup[]> {
    return prisma.ledgerGroup.findMany({
      where: buildWhere(companyId, filters),
      orderBy: { name: "asc" },
    });
  },

  findById(id: string): Promise<LedgerGroup | null> {
    return prisma.ledgerGroup.findUnique({ where: { id } });
  },

  countActiveChildren(parentGroupId: string): Promise<number> {
    return prisma.ledgerGroup.count({ where: { parentGroupId, isActive: true } });
  },

  async create(companyId: string, data: LedgerGroupCreateData): Promise<LedgerGroup> {
    return prisma.ledgerGroup.create({
      data: {
        ...data,
        companyId,
      },
    });
  },

  // Company-scoping and the "system-defined groups can never be renamed" rule
  // are checked in the same transaction as the write — no concurrent-mutation
  // race exists here (companyId and isSystemDefined are both immutable), so
  // plain Read Committed is sufficient; unlike deactivate() below, no
  // Serializable/retry is needed.
  async update(id: string, companyId: string, data: LedgerGroupUpdateData): Promise<LedgerGroup | null> {
    return prisma.$transaction(async (tx) => {
      const existing = await tx.ledgerGroup.findUnique({ where: { id } });
      if (!existing || existing.companyId !== companyId) {
        return null;
      }
      if (existing.isSystemDefined) {
        throw new AppError("System-defined groups cannot be renamed.");
      }

      try {
        return await tx.ledgerGroup.update({ where: { id }, data });
      } catch (error) {
        if (isRecordNotFoundError(error)) {
          return null;
        }
        throw error;
      }
    });
  },

  async activate(id: string, companyId: string): Promise<LedgerGroup | null> {
    return prisma.$transaction(async (tx) => {
      const existing = await tx.ledgerGroup.findUnique({ where: { id } });
      if (!existing || existing.companyId !== companyId) {
        return null;
      }

      return tx.ledgerGroup.update({ where: { id }, data: { isActive: true } });
    });
  },

  /**
   * Bundles the tenant-isolation check, the "system-defined groups can never
   * be deactivated" rule, and the "cannot deactivate a group with an active
   * child" invariant into one Serializable transaction — mirroring the
   * financial-year/user/role modules' identical "count-then-write invariant
   * → Serializable + bounded retry" recipe. Without Serializable isolation, a
   * concurrent request activating (or creating) a child group could race
   * past this count check.
   */
  deactivate(id: string, companyId: string): Promise<DeactivateLedgerGroupResult> {
    return withRetry(() =>
      prisma.$transaction(async (tx) => {
        const existing = await tx.ledgerGroup.findUnique({ where: { id } });
        if (!existing || existing.companyId !== companyId) {
          return { status: "not_found" };
        }
        if (existing.isSystemDefined) {
          return { status: "system_defined" };
        }

        const activeChildren = await tx.ledgerGroup.count({
          where: { parentGroupId: id, isActive: true },
        });
        if (activeChildren > 0) {
          return { status: "has_active_children" };
        }

        const ledgerGroup = await tx.ledgerGroup.update({
          where: { id },
          data: { isActive: false },
        });

        return { status: "ok", ledgerGroup };
      }, SERIALIZABLE)
    );
  },

  /**
   * Seeds the standard 23-group chart-of-accounts skeleton for a brand-new
   * company, participating in the caller's own transaction (companyService.
   * createCompany()'s) so a seeding failure rolls the whole company creation
   * back with it. Two passes — every DEFAULT_LEDGER_GROUPS entry's `parent`
   * references a top-level group's name, so parents always exist before any
   * child references them.
   */
  async seedDefaults(companyId: string, tx: Prisma.TransactionClient): Promise<void> {
    const idByName = new Map<string, string>();

    for (const seed of DEFAULT_LEDGER_GROUPS.filter((group) => group.parent === null)) {
      const created = await tx.ledgerGroup.create({
        data: {
          companyId,
          name: seed.name,
          parentGroupId: null,
          natureType: seed.nature,
          affectsGrossProfit: seed.affectsGrossProfit,
          isSystemDefined: true,
        },
      });
      idByName.set(seed.name, created.id);
    }

    for (const seed of DEFAULT_LEDGER_GROUPS.filter((group) => group.parent !== null)) {
      const parentId = idByName.get(seed.parent as string);
      if (!parentId) {
        throw new AppError(`Seed data error: parent group "${seed.parent}" was not found.`);
      }

      const created = await tx.ledgerGroup.create({
        data: {
          companyId,
          name: seed.name,
          parentGroupId: parentId,
          natureType: seed.nature,
          affectsGrossProfit: seed.affectsGrossProfit,
          isSystemDefined: true,
        },
      });
      idByName.set(seed.name, created.id);
    }
  },
};
