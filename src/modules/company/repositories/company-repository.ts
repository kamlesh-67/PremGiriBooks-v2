import type { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import type { CompanyPersistData } from "@/modules/company/utils/normalize-company-input";
import type { CompanyListFilters, CompanyWithSettings } from "@/types/company";

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

  create(data: CompanyPersistData): Promise<CompanyWithSettings> {
    return prisma.company.create({
      data: {
        ...data,
        settings: { create: {} },
      },
      include: { settings: true },
    });
  },

  update(id: string, data: CompanyPersistData): Promise<CompanyWithSettings> {
    return prisma.company.update({
      where: { id },
      data,
      include: { settings: true },
    });
  },

  setActive(id: string, isActive: boolean): Promise<CompanyWithSettings> {
    return prisma.company.update({
      where: { id },
      data: { isActive },
      include: { settings: true },
    });
  },

  count(filters: CompanyListFilters): Promise<number> {
    return prisma.company.count({ where: buildWhere(filters) });
  },
};
