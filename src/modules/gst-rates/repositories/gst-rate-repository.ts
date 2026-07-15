import type { GstRate as PrismaGstRate, Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { runInTransaction } from "@/lib/transaction";
import { isRecordNotFoundError } from "@/lib/prisma-errors";
import type {
  ActivateGstRateResult,
  DeactivateGstRateResult,
  GstRate,
  GstRateListFilters,
} from "@/types/gst-rate";

export interface GstRatePersistData {
  name: string;
  ratePercent: number;
  cessPercent: number;
  description: string | null;
}

// `ratePercent`/`cessPercent` are Prisma `Decimal` (decimal.js) instances at
// the database boundary — never serializable across a Server Component prop
// or a Server Action return value, so every read is normalized to plain
// `number`s here, before it can reach a Client Component (mirrors
// ledger-repository.ts's toLedger()).
function toGstRate(raw: PrismaGstRate): GstRate {
  return {
    ...raw,
    ratePercent: raw.ratePercent.toNumber(),
    cessPercent: raw.cessPercent.toNumber(),
  };
}

function buildWhere(companyId: string, filters: GstRateListFilters): Prisma.GstRateWhereInput {
  const where: Prisma.GstRateWhereInput = { companyId };

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

export const gstRateRepository = {
  async findMany(companyId: string, filters: GstRateListFilters = {}): Promise<GstRate[]> {
    const rows = await prisma.gstRate.findMany({
      where: buildWhere(companyId, filters),
      orderBy: { name: "asc" },
    });
    return rows.map(toGstRate);
  },

  async findById(id: string): Promise<GstRate | null> {
    const row = await prisma.gstRate.findUnique({ where: { id } });
    return row ? toGstRate(row) : null;
  },

  async create(companyId: string, data: GstRatePersistData): Promise<GstRate> {
    const row = await prisma.gstRate.create({ data: { ...data, companyId } });
    return toGstRate(row);
  },

  // Company-scoping is checked in the same transaction as the write,
  // mirroring unit-repository.ts's update(). There is no immutable-field rule
  // to enforce here — every GstRate field remains editable while nothing
  // references a rate (23-gst-rate-management.md).
  async update(id: string, companyId: string, data: GstRatePersistData): Promise<GstRate | null> {
    return runInTransaction(async (tx) => {
      const existing = await tx.gstRate.findUnique({ where: { id } });
      if (!existing || existing.companyId !== companyId) {
        return null;
      }

      try {
        const row = await tx.gstRate.update({ where: { id }, data });
        return toGstRate(row);
      } catch (error) {
        if (isRecordNotFoundError(error)) {
          return null;
        }
        throw error;
      }
    });
  },

  async activate(id: string, companyId: string): Promise<ActivateGstRateResult> {
    return runInTransaction(async (tx) => {
      const existing = await tx.gstRate.findUnique({ where: { id } });
      if (!existing || existing.companyId !== companyId) {
        return { status: "not_found" };
      }

      const row = await tx.gstRate.update({ where: { id }, data: { isActive: true } });
      return { status: "ok", gstRate: toGstRate(row) };
    });
  },

  // Deactivation has no invariant to guard — a plain scoped update. Products
  // referencing a deactivated rate keep their reference; selectable lookups
  // list active rates only (23-gst-rate-management.md), so no
  // count-then-write / Serializable isolation is needed, mirroring
  // unit-repository.ts's deactivate().
  async deactivate(id: string, companyId: string): Promise<DeactivateGstRateResult> {
    return runInTransaction(async (tx) => {
      const existing = await tx.gstRate.findUnique({ where: { id } });
      if (!existing || existing.companyId !== companyId) {
        return { status: "not_found" };
      }

      const row = await tx.gstRate.update({ where: { id }, data: { isActive: false } });
      return { status: "ok", gstRate: toGstRate(row) };
    });
  },
};
