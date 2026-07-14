import type { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { runInTransaction } from "@/lib/transaction";
import { isRecordNotFoundError } from "@/modules/units/utils/prisma-errors";
import type {
  ActivateUnitResult,
  DeactivateUnitResult,
  Unit,
  UnitListFilters,
} from "@/types/unit";

export interface UnitPersistData {
  name: string;
  symbol: string;
  uqcCode: string | null;
  decimalPlaces: number;
  description: string | null;
}

function buildWhere(companyId: string, filters: UnitListFilters): Prisma.UnitWhereInput {
  const where: Prisma.UnitWhereInput = { companyId };

  if (filters.status === "active") {
    where.isActive = true;
  } else if (filters.status === "inactive") {
    where.isActive = false;
  }

  if (filters.search) {
    where.OR = [
      { name: { contains: filters.search, mode: "insensitive" } },
      { symbol: { contains: filters.search, mode: "insensitive" } },
    ];
  }

  return where;
}

export const unitRepository = {
  async findMany(companyId: string, filters: UnitListFilters = {}): Promise<Unit[]> {
    return prisma.unit.findMany({
      where: buildWhere(companyId, filters),
      orderBy: { name: "asc" },
    });
  },

  async findById(id: string): Promise<Unit | null> {
    return prisma.unit.findUnique({ where: { id } });
  },

  async create(companyId: string, data: UnitPersistData): Promise<Unit> {
    return prisma.unit.create({ data: { ...data, companyId } });
  },

  // Company-scoping is checked in the same transaction as the write,
  // mirroring ledger-repository.ts's update(). There is no immutable-field
  // rule to enforce here — every Unit field remains editable
  // (19-unit-management.md).
  async update(id: string, companyId: string, data: UnitPersistData): Promise<Unit | null> {
    return runInTransaction(async (tx) => {
      const existing = await tx.unit.findUnique({ where: { id } });
      if (!existing || existing.companyId !== companyId) {
        return null;
      }

      try {
        return await tx.unit.update({ where: { id }, data });
      } catch (error) {
        if (isRecordNotFoundError(error)) {
          return null;
        }
        throw error;
      }
    });
  },

  async activate(id: string, companyId: string): Promise<ActivateUnitResult> {
    return runInTransaction(async (tx) => {
      const existing = await tx.unit.findUnique({ where: { id } });
      if (!existing || existing.companyId !== companyId) {
        return { status: "not_found" };
      }

      const unit = await tx.unit.update({ where: { id }, data: { isActive: true } });
      return { status: "ok", unit };
    });
  },

  // No count-then-write invariant exists here — a Unit has no children and
  // (until Product Management, phase-tracker #23) no dependents — so no
  // Serializable isolation/retry is needed, mirroring ledger-repository.ts's
  // deactivate().
  async deactivate(id: string, companyId: string): Promise<DeactivateUnitResult> {
    return runInTransaction(async (tx) => {
      const existing = await tx.unit.findUnique({ where: { id } });
      if (!existing || existing.companyId !== companyId) {
        return { status: "not_found" };
      }

      const unit = await tx.unit.update({ where: { id }, data: { isActive: false } });
      return { status: "ok", unit };
    });
  },
};
