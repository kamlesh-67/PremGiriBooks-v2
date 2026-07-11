import type { CompanySettings } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import type { CompanySettingsInput } from "@/modules/company/validation/company-schema";

export const companySettingsRepository = {
  findByCompanyId(companyId: string): Promise<CompanySettings | null> {
    return prisma.companySettings.findUnique({ where: { companyId } });
  },

  update(companyId: string, data: CompanySettingsInput): Promise<CompanySettings> {
    return prisma.companySettings.update({
      where: { companyId },
      data,
    });
  },
};
