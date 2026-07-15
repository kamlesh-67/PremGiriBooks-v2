"use server";

import { runAction } from "@/lib/run-action";
import { brandService } from "@/modules/brands/services/brand-service";
import type {
  CreateBrandInput,
  UpdateBrandInput,
} from "@/modules/brands/validation/brand-schema";
import type { ActionResult } from "@/types/api";
import type { Brand } from "@/types/brand";

const LIST_PATH = "/masters/brands";

export async function createBrandAction(input: CreateBrandInput): Promise<ActionResult<Brand>> {
  return runAction(() => brandService.createBrand(input), [LIST_PATH]);
}

export async function updateBrandAction(
  id: string,
  input: UpdateBrandInput
): Promise<ActionResult<Brand>> {
  return runAction(() => brandService.updateBrand(id, input), [
    LIST_PATH,
    `/masters/brands/${id}/edit`,
  ]);
}

export async function activateBrandAction(id: string): Promise<ActionResult<Brand>> {
  return runAction(() => brandService.activateBrand(id), [LIST_PATH]);
}

export async function deactivateBrandAction(id: string): Promise<ActionResult<Brand>> {
  return runAction(() => brandService.deactivateBrand(id), [LIST_PATH]);
}
