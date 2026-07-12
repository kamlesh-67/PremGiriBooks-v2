import type { Company, CompanySettings } from "@prisma/client";

export type { Company, CompanySettings };

export type CompanyWithSettings = Company & {
  settings: CompanySettings | null;
};

export type CompanyStatusFilter = "all" | "active" | "inactive";

export interface CompanyListFilters {
  search?: string;
  status?: CompanyStatusFilter;
}
