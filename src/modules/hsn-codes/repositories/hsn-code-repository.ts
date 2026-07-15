import type { HsnCodeType, Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { runInTransaction } from "@/lib/transaction";
import { isRecordNotFoundError } from "@/lib/prisma-errors";
import type {
  ActivateHsnCodeResult,
  DeactivateHsnCodeResult,
  HsnCode,
  HsnCodeListFilters,
} from "@/types/hsn-code";

export interface HsnCodePersistData {
  code: string;
  codeType: HsnCodeType;
  description: string;
}

function buildWhere(companyId: string, filters: HsnCodeListFilters): Prisma.HsnCodeWhereInput {
  const where: Prisma.HsnCodeWhereInput = { companyId };

  if (filters.status === "active") {
    where.isActive = true;
  } else if (filters.status === "inactive") {
    where.isActive = false;
  }

  if (filters.codeType) {
    where.codeType = filters.codeType;
  }

  if (filters.search) {
    where.OR = [
      { code: { contains: filters.search, mode: "insensitive" } },
      { description: { contains: filters.search, mode: "insensitive" } },
    ];
  }

  return where;
}

export const hsnCodeRepository = {
  async findMany(companyId: string, filters: HsnCodeListFilters = {}): Promise<HsnCode[]> {
    return prisma.hsnCode.findMany({
      where: buildWhere(companyId, filters),
      orderBy: { code: "asc" },
    });
  },

  async findById(id: string): Promise<HsnCode | null> {
    return prisma.hsnCode.findUnique({ where: { id } });
  },

  async create(companyId: string, data: HsnCodePersistData): Promise<HsnCode> {
    return prisma.hsnCode.create({ data: { ...data, companyId } });
  },

  // Company-scoping is checked in the same transaction as the write,
  // mirroring unit-repository.ts's update(). There is no immutable-field
  // rule to enforce here — every HsnCode field remains editable, including
  // code and codeType (22-hsn-management.md).
  async update(id: string, companyId: string, data: HsnCodePersistData): Promise<HsnCode | null> {
    return runInTransaction(async (tx) => {
      const existing = await tx.hsnCode.findUnique({ where: { id } });
      if (!existing || existing.companyId !== companyId) {
        return null;
      }

      try {
        return await tx.hsnCode.update({ where: { id }, data });
      } catch (error) {
        if (isRecordNotFoundError(error)) {
          return null;
        }
        throw error;
      }
    });
  },

  async activate(id: string, companyId: string): Promise<ActivateHsnCodeResult> {
    return runInTransaction(async (tx) => {
      const existing = await tx.hsnCode.findUnique({ where: { id } });
      if (!existing || existing.companyId !== companyId) {
        return { status: "not_found" };
      }

      const hsnCode = await tx.hsnCode.update({ where: { id }, data: { isActive: true } });
      return { status: "ok", hsnCode };
    });
  },

  // No count-then-write invariant exists here — an HsnCode has no children
  // and (until Product Management, phase-tracker #23) no dependents — so no
  // Serializable isolation/retry is needed, mirroring unit-repository.ts's
  // deactivate().
  async deactivate(id: string, companyId: string): Promise<DeactivateHsnCodeResult> {
    return runInTransaction(async (tx) => {
      const existing = await tx.hsnCode.findUnique({ where: { id } });
      if (!existing || existing.companyId !== companyId) {
        return { status: "not_found" };
      }

      const hsnCode = await tx.hsnCode.update({ where: { id }, data: { isActive: false } });
      return { status: "ok", hsnCode };
    });
  },
};
