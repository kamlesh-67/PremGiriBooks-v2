import { AppError } from "@/lib/app-error";
import { getCurrentUser, getCurrentCompanyUser } from "@/lib/current-user";
import { assertPermission } from "@/lib/permissions";
import { financialYearRepository } from "@/modules/financial-year/repositories/financial-year-repository";
import { normalizeFinancialYearInput } from "@/modules/financial-year/utils/normalize-financial-year-input";
import {
  financialYearSchema,
  type FinancialYearInput,
} from "@/modules/financial-year/validation/financial-year-schema";
import type { CloseFinancialYearResult, FinancialYear } from "@/types/financial-year";

export const financialYearService = {
  async listFinancialYears(companyId: string): Promise<FinancialYear[]> {
    const user = await getCurrentUser();
    if (user.userType !== "PLATFORM" && user.companyId !== companyId) {
      return [];
    }

    return financialYearRepository.findMany(companyId);
  },

  async listSelectableFinancialYears(companyId: string): Promise<FinancialYear[]> {
    const financialYears = await this.listFinancialYears(companyId);
    return financialYears.filter((financialYear) => !financialYear.isClosed);
  },

  async getFinancialYear(id: string): Promise<FinancialYear | null> {
    const financialYear = await financialYearRepository.findById(id);
    if (!financialYear) {
      return null;
    }

    const user = await getCurrentUser();
    if (user.userType !== "PLATFORM" && user.companyId !== financialYear.companyId) {
      return null;
    }

    return financialYear;
  },

  async createFinancialYear(companyId: string, input: FinancialYearInput): Promise<FinancialYear> {
    const user = await getCurrentCompanyUser();
    await assertPermission(user, "financial-year", "create");
    if (user.companyId !== companyId) {
      throw new AppError("Financial year not found.");
    }

    const data = normalizeFinancialYearInput(financialYearSchema.parse(input));
    return financialYearRepository.create(companyId, data);
  },

  async updateFinancialYear(id: string, input: FinancialYearInput): Promise<FinancialYear> {
    const user = await getCurrentCompanyUser();
    await assertPermission(user, "financial-year", "edit");

    const existing = await financialYearRepository.findById(id);
    if (!existing || existing.companyId !== user.companyId) {
      throw new AppError("Financial year not found.");
    }
    if (existing.isClosed) {
      throw new AppError("Closed financial years cannot be edited.");
    }

    const data = normalizeFinancialYearInput(financialYearSchema.parse(input));
    const updated = await financialYearRepository.update(id, existing.companyId, data);
    if (!updated) {
      throw new AppError("Financial year not found.");
    }
    return updated;
  },

  async setCurrent(id: string): Promise<FinancialYear> {
    const user = await getCurrentCompanyUser();
    await assertPermission(user, "financial-year", "edit");

    const financialYear = await financialYearRepository.findById(id);
    if (!financialYear || financialYear.companyId !== user.companyId) {
      throw new AppError("Financial year not found.");
    }
    if (financialYear.isClosed) {
      throw new AppError("Closed financial years cannot be set as current.");
    }

    return financialYearRepository.setCurrent(financialYear.companyId, id);
  },

  async closeFinancialYear(id: string): Promise<CloseFinancialYearResult> {
    const user = await getCurrentCompanyUser();
    await assertPermission(user, "financial-year", "edit");

    const financialYear = await financialYearRepository.findById(id);
    if (!financialYear || financialYear.companyId !== user.companyId) {
      throw new AppError("Financial year not found.");
    }
    if (financialYear.isClosed) {
      throw new AppError("Financial year is already closed.");
    }

    return financialYearRepository.close(financialYear.companyId, id);
  },
};
