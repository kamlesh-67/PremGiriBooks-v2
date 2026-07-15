import { AppError } from "@/lib/app-error";
import { getCurrentCompanyUser } from "@/lib/current-user";
import { assertPermission } from "@/lib/permissions";
import {
  brandRepository,
  type BrandPersistData,
} from "@/modules/brands/repositories/brand-repository";
import { isUniqueConstraintError } from "@/lib/prisma-errors";
import {
  createBrandSchema,
  updateBrandSchema,
  type CreateBrandInput,
  type UpdateBrandInput,
} from "@/modules/brands/validation/brand-schema";
import type { Brand, BrandListFilters } from "@/types/brand";

// The permission catalog (11-role-permissions.md) has no dedicated
// activate/deactivate action, only view/create/edit/delete/approve/export —
// Activate and Deactivate both gate on "delete", mirroring
// ledger-service.ts's identical reasoning.
const LIFECYCLE_ACTION = "delete";

// Brand's single per-company unique constraint (21-brand-management.md's
// Business Rules) gets a field-specific friendly message.
function translatePersistError(error: unknown): never {
  if (isUniqueConstraintError(error, "name")) {
    throw new AppError("A brand with this name already exists in this company.");
  }
  throw error;
}

function toPersistData(data: CreateBrandInput): BrandPersistData {
  return {
    name: data.name,
    description: data.description ?? null,
  };
}

export const brandService = {
  async listBrands(filters: BrandListFilters = {}): Promise<Brand[]> {
    const user = await getCurrentCompanyUser();
    await assertPermission(user, "masters", "view");
    return brandRepository.findMany(user.companyId, filters);
  },

  // A brand belonging to a different company must resolve identically to
  // "not found" — never distinguish "exists but isn't yours" from "doesn't
  // exist," mirroring unit-service.ts's identical rule.
  async getBrand(id: string): Promise<Brand | null> {
    const user = await getCurrentCompanyUser();
    await assertPermission(user, "masters", "view");

    const brand = await brandRepository.findById(id);
    if (!brand || brand.companyId !== user.companyId) {
      return null;
    }
    return brand;
  },

  /**
   * Active brands for the current company — the lookup Product Management
   * (phase-tracker #23) will consume for its Brand picker.
   */
  async listSelectableBrands(): Promise<Brand[]> {
    const user = await getCurrentCompanyUser();
    await assertPermission(user, "masters", "view");
    return brandRepository.findMany(user.companyId, { status: "active" });
  },

  async createBrand(input: CreateBrandInput): Promise<Brand> {
    const user = await getCurrentCompanyUser();
    await assertPermission(user, "masters", "create");

    const data = createBrandSchema.parse(input);

    try {
      return await brandRepository.create(user.companyId, toPersistData(data));
    } catch (error) {
      translatePersistError(error);
    }
  },

  async updateBrand(id: string, input: UpdateBrandInput): Promise<Brand> {
    const user = await getCurrentCompanyUser();
    await assertPermission(user, "masters", "edit");

    const data = updateBrandSchema.parse(input);

    try {
      const brand = await brandRepository.update(id, user.companyId, toPersistData(data));
      if (!brand) {
        throw new AppError("Brand not found.");
      }
      return brand;
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      translatePersistError(error);
    }
  },

  async activateBrand(id: string): Promise<Brand> {
    const user = await getCurrentCompanyUser();
    await assertPermission(user, "masters", LIFECYCLE_ACTION);

    const result = await brandRepository.activate(id, user.companyId);
    switch (result.status) {
      case "not_found":
        throw new AppError("Brand not found.");
      case "ok":
        return result.brand;
    }
  },

  async deactivateBrand(id: string): Promise<Brand> {
    const user = await getCurrentCompanyUser();
    await assertPermission(user, "masters", LIFECYCLE_ACTION);

    const result = await brandRepository.deactivate(id, user.companyId);
    switch (result.status) {
      case "not_found":
        throw new AppError("Brand not found.");
      case "ok":
        return result.brand;
    }
  },
};
