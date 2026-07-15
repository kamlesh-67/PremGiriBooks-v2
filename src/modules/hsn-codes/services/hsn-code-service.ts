import { AppError } from "@/lib/app-error";
import { getCurrentCompanyUser } from "@/lib/current-user";
import { assertPermission } from "@/lib/permissions";
import {
  hsnCodeRepository,
  type HsnCodePersistData,
} from "@/modules/hsn-codes/repositories/hsn-code-repository";
import { isUniqueConstraintError } from "@/lib/prisma-errors";
import {
  createHsnCodeSchema,
  updateHsnCodeSchema,
  type CreateHsnCodeInput,
  type UpdateHsnCodeInput,
} from "@/modules/hsn-codes/validation/hsn-code-schema";
import type { HsnCode, HsnCodeListFilters, HsnCodeType } from "@/types/hsn-code";

// The permission catalog (11-role-permissions.md) has no dedicated
// activate/deactivate action, only view/create/edit/delete/approve/export —
// Activate and Deactivate both gate on "delete", mirroring
// ledger-service.ts's identical reasoning.
const LIFECYCLE_ACTION = "delete";

// One per-company unique constraint — `code`, shared across both code types
// (22-hsn-management.md's Business Rules). Surface it with a field-specific
// friendly message.
function translatePersistError(error: unknown): never {
  if (isUniqueConstraintError(error, "code")) {
    throw new AppError("An HSN/SAC code with this code already exists in this company.");
  }
  throw error;
}

function toPersistData(data: CreateHsnCodeInput): HsnCodePersistData {
  return {
    code: data.code,
    codeType: data.codeType,
    description: data.description,
  };
}

export const hsnCodeService = {
  async listHsnCodes(filters: HsnCodeListFilters = {}): Promise<HsnCode[]> {
    const user = await getCurrentCompanyUser();
    await assertPermission(user, "masters", "view");
    return hsnCodeRepository.findMany(user.companyId, filters);
  },

  // An HSN code belonging to a different company must resolve identically to
  // "not found" — never distinguish "exists but isn't yours" from "doesn't
  // exist," mirroring unit-service.ts's identical rule.
  async getHsnCode(id: string): Promise<HsnCode | null> {
    const user = await getCurrentCompanyUser();
    await assertPermission(user, "masters", "view");

    const hsnCode = await hsnCodeRepository.findById(id);
    if (!hsnCode || hsnCode.companyId !== user.companyId) {
      return null;
    }
    return hsnCode;
  },

  /**
   * Active HSN/SAC codes for the current company — the lookup Product
   * Management (phase-tracker #23) will consume for its HSN picker,
   * filterable by codeType so the Product form can offer HSN codes to goods
   * and SAC codes to services.
   */
  async listSelectableHsnCodes(codeType?: HsnCodeType): Promise<HsnCode[]> {
    const user = await getCurrentCompanyUser();
    await assertPermission(user, "masters", "view");
    return hsnCodeRepository.findMany(user.companyId, { status: "active", codeType });
  },

  async createHsnCode(input: CreateHsnCodeInput): Promise<HsnCode> {
    const user = await getCurrentCompanyUser();
    await assertPermission(user, "masters", "create");

    const data = createHsnCodeSchema.parse(input);

    try {
      return await hsnCodeRepository.create(user.companyId, toPersistData(data));
    } catch (error) {
      translatePersistError(error);
    }
  },

  async updateHsnCode(id: string, input: UpdateHsnCodeInput): Promise<HsnCode> {
    const user = await getCurrentCompanyUser();
    await assertPermission(user, "masters", "edit");

    const data = updateHsnCodeSchema.parse(input);

    try {
      const hsnCode = await hsnCodeRepository.update(id, user.companyId, toPersistData(data));
      if (!hsnCode) {
        throw new AppError("HSN/SAC code not found.");
      }
      return hsnCode;
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      translatePersistError(error);
    }
  },

  async activateHsnCode(id: string): Promise<HsnCode> {
    const user = await getCurrentCompanyUser();
    await assertPermission(user, "masters", LIFECYCLE_ACTION);

    const result = await hsnCodeRepository.activate(id, user.companyId);
    switch (result.status) {
      case "not_found":
        throw new AppError("HSN/SAC code not found.");
      case "ok":
        return result.hsnCode;
    }
  },

  async deactivateHsnCode(id: string): Promise<HsnCode> {
    const user = await getCurrentCompanyUser();
    await assertPermission(user, "masters", LIFECYCLE_ACTION);

    const result = await hsnCodeRepository.deactivate(id, user.companyId);
    switch (result.status) {
      case "not_found":
        throw new AppError("HSN/SAC code not found.");
      case "ok":
        return result.hsnCode;
    }
  },
};
