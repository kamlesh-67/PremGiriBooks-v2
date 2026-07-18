import { AppError } from "@/lib/app-error";
import { getCurrentCompanyUser } from "@/lib/current-user";
import { assertPermission } from "@/lib/permissions";
import { isUniqueConstraintError } from "@/lib/prisma-errors";
import {
  warehouseRepository,
  type WarehousePersistData,
} from "@/modules/warehouses/repositories/warehouse-repository";
import {
  createWarehouseSchema,
  updateWarehouseSchema,
  type CreateWarehouseInput,
  type UpdateWarehouseInput,
} from "@/modules/warehouses/validation/warehouse-schema";
import type {
  Warehouse,
  WarehouseBranchOption,
  WarehouseListFilters,
  WarehouseWithBranch,
} from "@/types/warehouse";

// The permission catalog (11-role-permissions.md) has no dedicated
// activate/deactivate action, only view/create/edit/delete/approve/export —
// Activate and Deactivate both gate on "delete", mirroring
// ledger-service.ts's identical reasoning. Set/unset default is an "edit"
// (24-warehouse-management.md's Security).
const LIFECYCLE_ACTION = "delete";

const NOT_FOUND_MESSAGE = "Warehouse not found.";

// Warehouse has TWO per-company unique constraints — name and code — so each
// duplicate surfaces its own field-specific friendly message
// (24-warehouse-management.md's Business Rules), mirroring unit-service.ts.
function translatePersistError(error: unknown): never {
  if (isUniqueConstraintError(error, "name")) {
    throw new AppError("A warehouse with this name already exists in this company.");
  }
  if (isUniqueConstraintError(error, "code")) {
    throw new AppError("A warehouse with this code already exists in this company.");
  }
  throw error;
}

function toPersistData(data: CreateWarehouseInput): WarehousePersistData {
  return {
    name: data.name,
    code: data.code,
    branchId: data.branchId ?? null,
    address: data.address ?? null,
    contactNumber: data.contactNumber ?? null,
  };
}

export const warehouseService = {
  async listWarehouses(filters: WarehouseListFilters = {}): Promise<WarehouseWithBranch[]> {
    const user = await getCurrentCompanyUser();
    await assertPermission(user, "masters", "view");
    return warehouseRepository.findMany(user.companyId, filters);
  },

  // A warehouse belonging to a different company must resolve identically to
  // "not found" — never distinguish "exists but isn't yours" from "doesn't
  // exist," mirroring unit-service.ts's identical rule.
  async getWarehouse(id: string): Promise<Warehouse | null> {
    const user = await getCurrentCompanyUser();
    await assertPermission(user, "masters", "view");

    const warehouse = await warehouseRepository.findById(id);
    if (!warehouse || warehouse.companyId !== user.companyId) {
      return null;
    }
    return warehouse;
  },

  /**
   * Active warehouses for the current company — the lookup Product
   * Management (phase-tracker #23) and the Inventory Engine (#30) will
   * consume.
   */
  async listSelectableWarehouses(): Promise<WarehouseWithBranch[]> {
    const user = await getCurrentCompanyUser();
    await assertPermission(user, "masters", "view");
    return warehouseRepository.findMany(user.companyId, { status: "active" });
  },

  /**
   * The branch picker's options: the company's active branches, plus (when
   * `includeBranchId` is supplied by the edit page) the edited warehouse's
   * current branch even if since deactivated, so the stored value stays
   * visible. Empty until Branch Management (12-branch-management.md) is
   * implemented — the picker renders "No branches", not an error.
   */
  async listSelectableBranches(includeBranchId?: string): Promise<WarehouseBranchOption[]> {
    const user = await getCurrentCompanyUser();
    await assertPermission(user, "masters", "view");
    return warehouseRepository.findSelectableBranches(user.companyId, includeBranchId);
  },

  async createWarehouse(input: CreateWarehouseInput): Promise<Warehouse> {
    const user = await getCurrentCompanyUser();
    await assertPermission(user, "masters", "create");

    const data = createWarehouseSchema.parse(input);

    try {
      return await warehouseRepository.create(user.companyId, toPersistData(data));
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      translatePersistError(error);
    }
  },

  async updateWarehouse(id: string, input: UpdateWarehouseInput): Promise<Warehouse> {
    const user = await getCurrentCompanyUser();
    await assertPermission(user, "masters", "edit");

    const data = updateWarehouseSchema.parse(input);

    try {
      const warehouse = await warehouseRepository.update(id, user.companyId, toPersistData(data));
      if (!warehouse) {
        throw new AppError(NOT_FOUND_MESSAGE);
      }
      return warehouse;
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      translatePersistError(error);
    }
  },

  async activateWarehouse(id: string): Promise<Warehouse> {
    const user = await getCurrentCompanyUser();
    await assertPermission(user, "masters", LIFECYCLE_ACTION);

    const result = await warehouseRepository.activate(id, user.companyId);
    switch (result.status) {
      case "not_found":
        throw new AppError(NOT_FOUND_MESSAGE);
      case "ok":
        return result.warehouse;
    }
  },

  async deactivateWarehouse(id: string): Promise<Warehouse> {
    const user = await getCurrentCompanyUser();
    await assertPermission(user, "masters", LIFECYCLE_ACTION);

    const result = await warehouseRepository.deactivate(id, user.companyId);
    switch (result.status) {
      case "not_found":
        throw new AppError(NOT_FOUND_MESSAGE);
      case "ok":
        return result.warehouse;
    }
  },

  async setDefaultWarehouse(id: string): Promise<Warehouse> {
    const user = await getCurrentCompanyUser();
    await assertPermission(user, "masters", "edit");

    const result = await warehouseRepository.setDefault(id, user.companyId);
    switch (result.status) {
      case "not_found":
        throw new AppError(NOT_FOUND_MESSAGE);
      case "inactive":
        throw new AppError("Only an active warehouse can be set as the default.");
      case "ok":
        return result.warehouse;
    }
  },

  async unsetDefaultWarehouse(id: string): Promise<Warehouse> {
    const user = await getCurrentCompanyUser();
    await assertPermission(user, "masters", "edit");

    const result = await warehouseRepository.unsetDefault(id, user.companyId);
    switch (result.status) {
      case "not_found":
        throw new AppError(NOT_FOUND_MESSAGE);
      case "ok":
        return result.warehouse;
    }
  },
};
