import { assertAdministrator, getCurrentUser } from "@/lib/current-user";
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
    if (user.role !== "Administrator" && user.companyId !== companyId) {
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
    if (user.role !== "Administrator" && user.companyId !== financialYear.companyId) {
      return null;
    }

    return financialYear;
  },

  async createFinancialYear(companyId: string, input: FinancialYearInput): Promise<FinancialYear> {
    await assertAdministrator();
    const data = normalizeFinancialYearInput(financialYearSchema.parse(input));
    return financialYearRepository.create(companyId, data);
  },

  async updateFinancialYear(id: string, input: FinancialYearInput): Promise<FinancialYear> {
    await assertAdministrator();

    const existing = await financialYearRepository.findById(id);
    if (!existing) {
      throw new Error("Financial year not found.");
    }
    if (existing.isClosed) {
      throw new Error("Closed financial years cannot be edited.");
    }

    const data = normalizeFinancialYearInput(financialYearSchema.parse(input));
    const updated = await financialYearRepository.update(id, existing.companyId, data);
    if (!updated) {
      throw new Error("Financial year not found.");
    }
    return updated;
  },

  async setCurrent(id: string): Promise<FinancialYear> {
    await assertAdministrator();

    const financialYear = await financialYearRepository.findById(id);
    if (!financialYear) {
      throw new Error("Financial year not found.");
    }
    if (financialYear.isClosed) {
      throw new Error("Closed financial years cannot be set as current.");
    }

    return financialYearRepository.setCurrent(financialYear.companyId, id);
  },

  async closeFinancialYear(id: string): Promise<CloseFinancialYearResult> {
    await assertAdministrator();

    const financialYear = await financialYearRepository.findById(id);
    if (!financialYear) {
      throw new Error("Financial year not found.");
    }
    if (financialYear.isClosed) {
      throw new Error("Financial year is already closed.");
    }

    return financialYearRepository.close(financialYear.companyId, id);
  },
};
