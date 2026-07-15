import { AppError } from "@/lib/app-error";
import { getCurrentCompanyUser } from "@/lib/current-user";
import { assertPermission } from "@/lib/permissions";
import {
  gstRateRepository,
  type GstRatePersistData,
} from "@/modules/gst-rates/repositories/gst-rate-repository";
import { isUniqueConstraintError } from "@/lib/prisma-errors";
import {
  createGstRateSchema,
  updateGstRateSchema,
  type CreateGstRateInput,
  type UpdateGstRateInput,
} from "@/modules/gst-rates/validation/gst-rate-schema";
import type { GstRate, GstRateListFilters } from "@/types/gst-rate";

// The permission catalog (11-role-permissions.md) has no dedicated
// activate/deactivate action, only view/create/edit/delete/approve/export —
// Activate and Deactivate both gate on "delete", mirroring
// ledger-service.ts's identical reasoning.
const LIFECYCLE_ACTION = "delete";

// GstRate has ONE per-company unique constraint — the name. Duplicate
// *percentages* under different names are deliberately allowed
// (23-gst-rate-management.md's Business Rules).
function translatePersistError(error: unknown): never {
  if (isUniqueConstraintError(error, "name")) {
    throw new AppError("A GST rate with this name already exists in this company.");
  }
  throw error;
}

// Decimal fields cross the Server Action boundary as plain numbers and are
// converted to the persisted shape here at the service edge, matching how
// Ledger.openingBalance is handled.
function toPersistData(data: CreateGstRateInput): GstRatePersistData {
  return {
    name: data.name,
    ratePercent: data.ratePercent,
    cessPercent: data.cessPercent ?? 0,
    description: data.description ?? null,
  };
}

export const gstRateService = {
  async listGstRates(filters: GstRateListFilters = {}): Promise<GstRate[]> {
    const user = await getCurrentCompanyUser();
    await assertPermission(user, "masters", "view");
    return gstRateRepository.findMany(user.companyId, filters);
  },

  // A rate belonging to a different company must resolve identically to
  // "not found" — never distinguish "exists but isn't yours" from "doesn't
  // exist," mirroring unit-service.ts's identical rule.
  async getGstRate(id: string): Promise<GstRate | null> {
    const user = await getCurrentCompanyUser();
    await assertPermission(user, "masters", "view");

    const gstRate = await gstRateRepository.findById(id);
    if (!gstRate || gstRate.companyId !== user.companyId) {
      return null;
    }
    return gstRate;
  },

  /**
   * Active rates for the current company — the lookup Product Management
   * (phase-tracker #23) will consume for its GST Rate picker.
   */
  async listSelectableGstRates(): Promise<GstRate[]> {
    const user = await getCurrentCompanyUser();
    await assertPermission(user, "masters", "view");
    return gstRateRepository.findMany(user.companyId, { status: "active" });
  },

  async createGstRate(input: CreateGstRateInput): Promise<GstRate> {
    const user = await getCurrentCompanyUser();
    await assertPermission(user, "masters", "create");

    const data = createGstRateSchema.parse(input);

    try {
      return await gstRateRepository.create(user.companyId, toPersistData(data));
    } catch (error) {
      translatePersistError(error);
    }
  },

  async updateGstRate(id: string, input: UpdateGstRateInput): Promise<GstRate> {
    const user = await getCurrentCompanyUser();
    await assertPermission(user, "masters", "edit");

    const data = updateGstRateSchema.parse(input);

    try {
      const gstRate = await gstRateRepository.update(id, user.companyId, toPersistData(data));
      if (!gstRate) {
        throw new AppError("GST rate not found.");
      }
      return gstRate;
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      translatePersistError(error);
    }
  },

  async activateGstRate(id: string): Promise<GstRate> {
    const user = await getCurrentCompanyUser();
    await assertPermission(user, "masters", LIFECYCLE_ACTION);

    const result = await gstRateRepository.activate(id, user.companyId);
    switch (result.status) {
      case "not_found":
        throw new AppError("GST rate not found.");
      case "ok":
        return result.gstRate;
    }
  },

  async deactivateGstRate(id: string): Promise<GstRate> {
    const user = await getCurrentCompanyUser();
    await assertPermission(user, "masters", LIFECYCLE_ACTION);

    const result = await gstRateRepository.deactivate(id, user.companyId);
    switch (result.status) {
      case "not_found":
        throw new AppError("GST rate not found.");
      case "ok":
        return result.gstRate;
    }
  },
};
