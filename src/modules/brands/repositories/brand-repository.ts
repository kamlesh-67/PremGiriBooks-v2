import type { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { runInTransaction } from "@/lib/transaction";
import { isRecordNotFoundError } from "@/lib/prisma-errors";
import type {
  ActivateBrandResult,
  Brand,
  BrandListFilters,
  DeactivateBrandResult,
} from "@/types/brand";

export interface BrandPersistData {
  name: string;
  description: string | null;
}

function buildWhere(companyId: string, filters: BrandListFilters): Prisma.BrandWhereInput {
  const where: Prisma.BrandWhereInput = { companyId };

  if (filters.status === "active") {
    where.isActive = true;
  } else if (filters.status === "inactive") {
    where.isActive = false;
  }

  if (filters.search) {
    where.name = { contains: filters.search, mode: "insensitive" };
  }

  return where;
}

export const brandRepository = {
  async findMany(companyId: string, filters: BrandListFilters = {}): Promise<Brand[]> {
    return prisma.brand.findMany({
      where: buildWhere(companyId, filters),
      orderBy: { name: "asc" },
    });
  },

  async findById(id: string): Promise<Brand | null> {
    return prisma.brand.findUnique({ where: { id } });
  },

  async create(companyId: string, data: BrandPersistData): Promise<Brand> {
    return prisma.brand.create({ data: { ...data, companyId } });
  },

  // Company-scoping is checked in the same transaction as the write,
  // mirroring unit-repository.ts's update(). There is no immutable-field
  // rule to enforce here — every Brand field remains editable
  // (21-brand-management.md).
  async update(id: string, companyId: string, data: BrandPersistData): Promise<Brand | null> {
    return runInTransaction(async (tx) => {
      const existing = await tx.brand.findUnique({ where: { id } });
      if (!existing || existing.companyId !== companyId) {
        return null;
      }

      try {
        return await tx.brand.update({ where: { id }, data });
      } catch (error) {
        if (isRecordNotFoundError(error)) {
          return null;
        }
        throw error;
      }
    });
  },

  async activate(id: string, companyId: string): Promise<ActivateBrandResult> {
    return runInTransaction(async (tx) => {
      const existing = await tx.brand.findUnique({ where: { id } });
      if (!existing || existing.companyId !== companyId) {
        return { status: "not_found" };
      }

      const brand = await tx.brand.update({ where: { id }, data: { isActive: true } });
      return { status: "ok", brand };
    });
  },

  // No count-then-write invariant exists here — a Brand has no children and
  // (until Product Management, phase-tracker #23) no dependents — so no
  // Serializable isolation/retry is needed, mirroring unit-repository.ts's
  // deactivate().
  async deactivate(id: string, companyId: string): Promise<DeactivateBrandResult> {
    return runInTransaction(async (tx) => {
      const existing = await tx.brand.findUnique({ where: { id } });
      if (!existing || existing.companyId !== companyId) {
        return { status: "not_found" };
      }

      const brand = await tx.brand.update({ where: { id }, data: { isActive: false } });
      return { status: "ok", brand };
    });
  },
};
