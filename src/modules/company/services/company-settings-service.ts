import type { CompanySettings } from "@prisma/client";

import { assertAdministrator } from "@/lib/current-user";
import { companySettingsRepository } from "@/modules/company/repositories/company-settings-repository";
import {
  companySettingsSchema,
  type CompanySettingsInput,
} from "@/modules/company/validation/company-schema";

export const companySettingsService = {
  getSettings(companyId: string): Promise<CompanySettings | null> {
    return companySettingsRepository.findByCompanyId(companyId);
  },

  async updateSettings(companyId: string, input: CompanySettingsInput): Promise<CompanySettings> {
    await assertAdministrator();
    const data = companySettingsSchema.parse(input);
    return companySettingsRepository.update(companyId, data);
  },
};
