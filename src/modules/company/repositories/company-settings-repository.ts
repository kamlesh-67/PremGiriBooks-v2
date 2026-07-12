import type { CompanySettings } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { isRecordNotFoundError } from "@/modules/company/utils/prisma-errors";
import type { CompanySettingsInput } from "@/modules/company/validation/company-schema";

export const companySettingsRepository = {
  findByCompanyId(companyId: string): Promise<CompanySettings | null> {
    return prisma.companySettings.findUnique({ where: { companyId } });
  },

  async update(companyId: string, data: CompanySettingsInput): Promise<CompanySettings | null> {
    try {
      return await prisma.companySettings.update({
        where: { companyId },
        data,
      });
    } catch (error) {
      if (isRecordNotFoundError(error)) {
        return null;
      }
      throw error;
    }
  },
};
