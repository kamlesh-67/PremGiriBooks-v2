"use server";

import { runAction } from "@/lib/run-action";
import { warehouseService } from "@/modules/warehouses/services/warehouse-service";
import type {
  CreateWarehouseInput,
  UpdateWarehouseInput,
} from "@/modules/warehouses/validation/warehouse-schema";
import type { ActionResult } from "@/types/api";
import type { Warehouse } from "@/types/warehouse";

const LIST_PATH = "/masters/warehouses";

export async function createWarehouseAction(
  input: CreateWarehouseInput
): Promise<ActionResult<Warehouse>> {
  return runAction(() => warehouseService.createWarehouse(input), [LIST_PATH]);
}

export async function updateWarehouseAction(
  id: string,
  input: UpdateWarehouseInput
): Promise<ActionResult<Warehouse>> {
  return runAction(() => warehouseService.updateWarehouse(id, input), [
    LIST_PATH,
    `/masters/warehouses/${id}/edit`,
  ]);
}

export async function activateWarehouseAction(id: string): Promise<ActionResult<Warehouse>> {
  return runAction(() => warehouseService.activateWarehouse(id), [LIST_PATH]);
}

export async function deactivateWarehouseAction(id: string): Promise<ActionResult<Warehouse>> {
  return runAction(() => warehouseService.deactivateWarehouse(id), [LIST_PATH]);
}

export async function setDefaultWarehouseAction(id: string): Promise<ActionResult<Warehouse>> {
  return runAction(() => warehouseService.setDefaultWarehouse(id), [LIST_PATH]);
}

export async function unsetDefaultWarehouseAction(id: string): Promise<ActionResult<Warehouse>> {
  return runAction(() => warehouseService.unsetDefaultWarehouse(id), [LIST_PATH]);
}
