import { AppError } from "@/lib/app-error";
import { getCurrentCompanyUser } from "@/lib/current-user";
import { assertPermission } from "@/lib/permissions";
import { unitRepository, type UnitPersistData } from "@/modules/units/repositories/unit-repository";
import { isUniqueConstraintError } from "@/lib/prisma-errors";
import {
  createUnitSchema,
  updateUnitSchema,
  type CreateUnitInput,
  type UpdateUnitInput,
} from "@/modules/units/validation/unit-schema";
import type { Unit, UnitListFilters } from "@/types/unit";

// The permission catalog (11-role-permissions.md) has no dedicated
// activate/deactivate action, only view/create/edit/delete/approve/export —
// Activate and Deactivate both gate on "delete", mirroring
// ledger-service.ts's identical reasoning.
const LIFECYCLE_ACTION = "delete";

// Unit has TWO per-company unique constraints; surface a field-specific
// message for each (19-unit-management.md's Business Rules).
function translatePersistError(error: unknown): never {
  if (isUniqueConstraintError(error, "symbol")) {
    throw new AppError("A unit with this symbol already exists in this company.");
  }
  if (isUniqueConstraintError(error, "name")) {
    throw new AppError("A unit with this name already exists in this company.");
  }
  throw error;
}

function toPersistData(data: CreateUnitInput): UnitPersistData {
  return {
    name: data.name,
    symbol: data.symbol,
    uqcCode: data.uqcCode ?? null,
    decimalPlaces: data.decimalPlaces,
    description: data.description ?? null,
  };
}

export const unitService = {
  async listUnits(filters: UnitListFilters = {}): Promise<Unit[]> {
    const user = await getCurrentCompanyUser();
    await assertPermission(user, "masters", "view");
    return unitRepository.findMany(user.companyId, filters);
  },

  // A unit belonging to a different company must resolve identically to
  // "not found" — never distinguish "exists but isn't yours" from "doesn't
  // exist," mirroring ledger-service.ts's identical rule.
  async getUnit(id: string): Promise<Unit | null> {
    const user = await getCurrentCompanyUser();
    await assertPermission(user, "masters", "view");

    const unit = await unitRepository.findById(id);
    if (!unit || unit.companyId !== user.companyId) {
      return null;
    }
    return unit;
  },

  /**
   * Active units for the current company — the lookup Product Management
   * (phase-tracker #23) will consume for its Unit picker.
   */
  async listSelectableUnits(): Promise<Unit[]> {
    const user = await getCurrentCompanyUser();
    await assertPermission(user, "masters", "view");
    return unitRepository.findMany(user.companyId, { status: "active" });
  },

  async createUnit(input: CreateUnitInput): Promise<Unit> {
    const user = await getCurrentCompanyUser();
    await assertPermission(user, "masters", "create");

    const data = createUnitSchema.parse(input);

    try {
      return await unitRepository.create(user.companyId, toPersistData(data));
    } catch (error) {
      translatePersistError(error);
    }
  },

  async updateUnit(id: string, input: UpdateUnitInput): Promise<Unit> {
    const user = await getCurrentCompanyUser();
    await assertPermission(user, "masters", "edit");

    const data = updateUnitSchema.parse(input);

    try {
      const unit = await unitRepository.update(id, user.companyId, toPersistData(data));
      if (!unit) {
        throw new AppError("Unit not found.");
      }
      return unit;
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      translatePersistError(error);
    }
  },

  async activateUnit(id: string): Promise<Unit> {
    const user = await getCurrentCompanyUser();
    await assertPermission(user, "masters", LIFECYCLE_ACTION);

    const result = await unitRepository.activate(id, user.companyId);
    switch (result.status) {
      case "not_found":
        throw new AppError("Unit not found.");
      case "ok":
        return result.unit;
    }
  },

  async deactivateUnit(id: string): Promise<Unit> {
    const user = await getCurrentCompanyUser();
    await assertPermission(user, "masters", LIFECYCLE_ACTION);

    const result = await unitRepository.deactivate(id, user.companyId);
    switch (result.status) {
      case "not_found":
        throw new AppError("Unit not found.");
      case "ok":
        return result.unit;
    }
  },
};
