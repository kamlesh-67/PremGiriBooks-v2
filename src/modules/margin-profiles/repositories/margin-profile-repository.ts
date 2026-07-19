import type { MarginProfile as PrismaMarginProfile, Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { runInTransaction } from "@/lib/transaction";
import { isRecordNotFoundError } from "@/lib/prisma-errors";
import type {
  ActivateMarginProfileResult,
  DeactivateMarginProfileResult,
  MarginProfile,
  MarginProfileListFilters,
} from "@/types/margin-profile";

export interface MarginProfilePersistData {
  name: string;
  calculationMode: PrismaMarginProfile["calculationMode"];
  retailPercent: number;
  wholesalePercent: number;
  dealerPercent: number;
  distributorPercent: number;
  description: string | null;
}

// The four Decimal(5,2) percent columns are Prisma `Decimal` (decimal.js)
// instances at the database boundary — never serializable across a Server
// Component prop or a Server Action return value, so every read is
// normalized to plain `number`s here, before it can reach a Client Component
// (mirrors gst-rate-repository.ts's toGstRate).
function toMarginProfile(raw: PrismaMarginProfile): MarginProfile {
  return {
    ...raw,
    retailPercent: raw.retailPercent.toNumber(),
    wholesalePercent: raw.wholesalePercent.toNumber(),
    dealerPercent: raw.dealerPercent.toNumber(),
    distributorPercent: raw.distributorPercent.toNumber(),
  };
}

function buildWhere(
  companyId: string,
  filters: MarginProfileListFilters
): Prisma.MarginProfileWhereInput {
  const where: Prisma.MarginProfileWhereInput = { companyId };

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

export const marginProfileRepository = {
  async findMany(
    companyId: string,
    filters: MarginProfileListFilters = {}
  ): Promise<MarginProfile[]> {
    const rows = await prisma.marginProfile.findMany({
      where: buildWhere(companyId, filters),
      orderBy: { name: "asc" },
    });
    return rows.map(toMarginProfile);
  },

  async findById(id: string): Promise<MarginProfile | null> {
    const row = await prisma.marginProfile.findUnique({ where: { id } });
    return row ? toMarginProfile(row) : null;
  },

  async create(companyId: string, data: MarginProfilePersistData): Promise<MarginProfile> {
    const row = await prisma.marginProfile.create({ data: { ...data, companyId } });
    return toMarginProfile(row);
  },

  // Company-scoping is checked in the same transaction as the write,
  // mirroring gst-rate-repository.ts's update(). No invariant to guard —
  // every field remains editable; changing percentages/mode only affects the
  // Pricing Engine's next calculation, nothing is denormalized onto products
  // (28-margin-profiles.md's Business Rules).
  async update(
    id: string,
    companyId: string,
    data: MarginProfilePersistData
  ): Promise<MarginProfile | null> {
    return runInTransaction(async (tx) => {
      const existing = await tx.marginProfile.findUnique({ where: { id } });
      if (!existing || existing.companyId !== companyId) {
        return null;
      }

      try {
        const row = await tx.marginProfile.update({ where: { id }, data });
        return toMarginProfile(row);
      } catch (error) {
        if (isRecordNotFoundError(error)) {
          return null;
        }
        throw error;
      }
    });
  },

  async activate(id: string, companyId: string): Promise<ActivateMarginProfileResult> {
    return runInTransaction(async (tx) => {
      const existing = await tx.marginProfile.findUnique({ where: { id } });
      if (!existing || existing.companyId !== companyId) {
        return { status: "not_found" };
      }

      const row = await tx.marginProfile.update({ where: { id }, data: { isActive: true } });
      return { status: "ok", marginProfile: toMarginProfile(row) };
    });
  },

  // Deactivation has no invariant to guard — a plain scoped update.
  // Products referencing a deactivated profile keep their reference; the
  // profile only disappears from listSelectableMarginProfiles()'s picker
  // (28-margin-profiles.md's Business Rules), mirroring gst-rate-repository
  // .ts's deactivate().
  async deactivate(id: string, companyId: string): Promise<DeactivateMarginProfileResult> {
    return runInTransaction(async (tx) => {
      const existing = await tx.marginProfile.findUnique({ where: { id } });
      if (!existing || existing.companyId !== companyId) {
        return { status: "not_found" };
      }

      const row = await tx.marginProfile.update({ where: { id }, data: { isActive: false } });
      return { status: "ok", marginProfile: toMarginProfile(row) };
    });
  },
};
