import type { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import type { CompanyPersistData } from "@/modules/company/utils/normalize-company-input";
import { isRecordNotFoundError } from "@/modules/company/utils/prisma-errors";
import type { CompanyListFilters, CompanyWithSettings } from "@/types/company";

type PrismaClientOrTransaction = typeof prisma | Prisma.TransactionClient;

function buildWhere(filters: CompanyListFilters): Prisma.CompanyWhereInput {
  const where: Prisma.CompanyWhereInput = {};

  if (filters.status === "active") {
    where.isActive = true;
  } else if (filters.status === "inactive") {
    where.isActive = false;
  }

  if (filters.search) {
    where.OR = [
      { companyName: { contains: filters.search, mode: "insensitive" } },
      { gstin: { contains: filters.search, mode: "insensitive" } },
      { mobileNumber: { contains: filters.search, mode: "insensitive" } },
    ];
  }

  return where;
}

export const companyRepository = {
  findMany(filters: CompanyListFilters): Promise<CompanyWithSettings[]> {
    return prisma.company.findMany({
      where: buildWhere(filters),
      include: { settings: true },
      orderBy: { companyName: "asc" },
    });
  },

  findById(id: string): Promise<CompanyWithSettings | null> {
    return prisma.company.findUnique({
      where: { id },
      include: { settings: true },
    });
  },

  // Accepts an optional transaction client so companyService.createCompany()
  // can run this as one step of a larger atomic unit of work (seeding the
  // default ledger group skeleton right after) — defaults to the plain
  // client for every other, non-transactional caller.
  create(
    data: CompanyPersistData,
    client: PrismaClientOrTransaction = prisma
  ): Promise<CompanyWithSettings> {
    return client.company.create({
      data: {
        ...data,
        settings: { create: {} },
      },
      include: { settings: true },
    });
  },

  async update(id: string, data: CompanyPersistData): Promise<CompanyWithSettings | null> {
    try {
      return await prisma.company.update({
        where: { id },
        data,
        include: { settings: true },
      });
    } catch (error) {
      if (isRecordNotFoundError(error)) {
        return null;
      }
      throw error;
    }
  },

  async setActive(id: string, isActive: boolean): Promise<CompanyWithSettings | null> {
    try {
      return await prisma.company.update({
        where: { id },
        data: { isActive },
        include: { settings: true },
      });
    } catch (error) {
      if (isRecordNotFoundError(error)) {
        return null;
      }
      throw error;
    }
  },

  count(filters: CompanyListFilters): Promise<number> {
    return prisma.company.count({ where: buildWhere(filters) });
  },
};
