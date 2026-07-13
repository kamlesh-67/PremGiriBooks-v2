import type { CompanySettings } from "@prisma/client";

import { AppError } from "@/lib/app-error";
import { assertAdministrator, getCurrentUser } from "@/lib/current-user";
import { companySettingsRepository } from "@/modules/company/repositories/company-settings-repository";
import {
  companySettingsSchema,
  type CompanySettingsInput,
} from "@/modules/company/validation/company-schema";

export const companySettingsService = {
  async getSettings(companyId: string): Promise<CompanySettings | null> {
    const user = await getCurrentUser();
    if (user.role !== "Administrator" && user.companyId !== companyId) {
      return null;
    }

    return companySettingsRepository.findByCompanyId(companyId);
  },

  async updateSettings(companyId: string, input: CompanySettingsInput): Promise<CompanySettings> {
    await assertAdministrator();
    const data = companySettingsSchema.parse(input);
    const settings = await companySettingsRepository.update(companyId, data);
    if (!settings) {
      throw new AppError("Company settings not found.");
    }
    return settings;
  },
};
