import { assertAdministrator, getCurrentUser } from "@/lib/current-user";
import { companyRepository } from "@/modules/company/repositories/company-repository";
import { normalizeCompanyInput } from "@/modules/company/utils/normalize-company-input";
import { companySchema, type CompanyInput } from "@/modules/company/validation/company-schema";
import type { CompanyListFilters, CompanyWithSettings } from "@/types/company";

export const companyService = {
  async listCompanies(filters: CompanyListFilters = {}): Promise<CompanyWithSettings[]> {
    const user = await getCurrentUser();
    if (user.role === "Administrator") {
      return companyRepository.findMany(filters);
    }

    if (!user.companyId) {
      return [];
    }

    const company = await companyRepository.findById(user.companyId);
    return company ? [company] : [];
  },

  async getCompany(id: string): Promise<CompanyWithSettings | null> {
    const user = await getCurrentUser();
    if (user.role !== "Administrator" && user.companyId !== id) {
      return null;
    }

    return companyRepository.findById(id);
  },

  async createCompany(input: CompanyInput): Promise<CompanyWithSettings> {
    await assertAdministrator();
    const data = normalizeCompanyInput(companySchema.parse(input));
    return companyRepository.create(data);
  },

  async updateCompany(id: string, input: CompanyInput): Promise<CompanyWithSettings> {
    await assertAdministrator();
    const data = normalizeCompanyInput(companySchema.parse(input));
    return companyRepository.update(id, data);
  },

  async activateCompany(id: string): Promise<CompanyWithSettings> {
    await assertAdministrator();
    return companyRepository.setActive(id, true);
  },

  async deactivateCompany(id: string): Promise<CompanyWithSettings> {
    await assertAdministrator();
    return companyRepository.setActive(id, false);
  },
};
