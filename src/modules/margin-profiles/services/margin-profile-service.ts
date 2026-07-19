import { AppError } from "@/lib/app-error";
import { getCurrentCompanyUser } from "@/lib/current-user";
import { assertPermission } from "@/lib/permissions";
import {
  marginProfileRepository,
  type MarginProfilePersistData,
} from "@/modules/margin-profiles/repositories/margin-profile-repository";
import { isUniqueConstraintError } from "@/lib/prisma-errors";
import {
  createMarginProfileSchema,
  updateMarginProfileSchema,
  type CreateMarginProfileInput,
  type UpdateMarginProfileInput,
} from "@/modules/margin-profiles/validation/margin-profile-schema";
import type { MarginProfile, MarginProfileListFilters } from "@/types/margin-profile";

// The permission catalog (11-role-permissions.md) has no dedicated
// activate/deactivate action, only view/create/edit/delete/approve/export —
// Activate and Deactivate both gate on "delete", mirroring
// gst-rate-service.ts's identical reasoning.
const LIFECYCLE_ACTION = "delete";

const NOT_FOUND_MESSAGE = "Margin profile not found.";

// MarginProfile has ONE per-company unique constraint — the name.
function translatePersistError(error: unknown): never {
  if (isUniqueConstraintError(error, "name")) {
    throw new AppError("A margin profile with this name already exists in this company.");
  }
  throw error;
}

// Decimal fields cross the Server Action boundary as plain numbers and are
// converted to the persisted shape here at the service edge, matching
// gst-rate-service.ts's toPersistData.
function toPersistData(data: CreateMarginProfileInput): MarginProfilePersistData {
  return {
    name: data.name,
    calculationMode: data.calculationMode,
    retailPercent: data.retailPercent,
    wholesalePercent: data.wholesalePercent,
    dealerPercent: data.dealerPercent,
    distributorPercent: data.distributorPercent,
    description: data.description ?? null,
  };
}

export const marginProfileService = {
  async listMarginProfiles(filters: MarginProfileListFilters = {}): Promise<MarginProfile[]> {
    const user = await getCurrentCompanyUser();
    await assertPermission(user, "masters", "view");
    return marginProfileRepository.findMany(user.companyId, filters);
  },

  // A profile belonging to a different company must resolve identically to
  // "not found" — never distinguish "exists but isn't yours" from "doesn't
  // exist," mirroring gst-rate-service.ts's identical rule.
  async getMarginProfile(id: string): Promise<MarginProfile | null> {
    const user = await getCurrentCompanyUser();
    await assertPermission(user, "masters", "view");

    const marginProfile = await marginProfileRepository.findById(id);
    if (!marginProfile || marginProfile.companyId !== user.companyId) {
      return null;
    }
    return marginProfile;
  },

  /**
   * Active profiles for the current company — the lookup the Product form
   * and the Pricing Engine (#28) consume.
   */
  async listSelectableMarginProfiles(): Promise<MarginProfile[]> {
    const user = await getCurrentCompanyUser();
    await assertPermission(user, "masters", "view");
    return marginProfileRepository.findMany(user.companyId, { status: "active" });
  },

  async createMarginProfile(input: CreateMarginProfileInput): Promise<MarginProfile> {
    const user = await getCurrentCompanyUser();
    await assertPermission(user, "masters", "create");

    const data = createMarginProfileSchema.parse(input);

    try {
      return await marginProfileRepository.create(user.companyId, toPersistData(data));
    } catch (error) {
      translatePersistError(error);
    }
  },

  async updateMarginProfile(id: string, input: UpdateMarginProfileInput): Promise<MarginProfile> {
    const user = await getCurrentCompanyUser();
    await assertPermission(user, "masters", "edit");

    const data = updateMarginProfileSchema.parse(input);

    try {
      const marginProfile = await marginProfileRepository.update(
        id,
        user.companyId,
        toPersistData(data)
      );
      if (!marginProfile) {
        throw new AppError(NOT_FOUND_MESSAGE);
      }
      return marginProfile;
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      translatePersistError(error);
    }
  },

  async activateMarginProfile(id: string): Promise<MarginProfile> {
    const user = await getCurrentCompanyUser();
    await assertPermission(user, "masters", LIFECYCLE_ACTION);

    const result = await marginProfileRepository.activate(id, user.companyId);
    switch (result.status) {
      case "not_found":
        throw new AppError(NOT_FOUND_MESSAGE);
      case "ok":
        return result.marginProfile;
    }
  },

  async deactivateMarginProfile(id: string): Promise<MarginProfile> {
    const user = await getCurrentCompanyUser();
    await assertPermission(user, "masters", LIFECYCLE_ACTION);

    const result = await marginProfileRepository.deactivate(id, user.companyId);
    switch (result.status) {
      case "not_found":
        throw new AppError(NOT_FOUND_MESSAGE);
      case "ok":
        return result.marginProfile;
    }
  },
};
