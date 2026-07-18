"use server";

import { runAction } from "@/lib/run-action";
import { productService } from "@/modules/products/services/product-service";
import type {
  CreateProductInput,
  UpdateProductInput,
} from "@/modules/products/validation/product-schema";
import type { ActionResult } from "@/types/api";
import type { ProductWithRelations } from "@/types/product";

const LIST_PATH = "/masters/products";

export async function createProductAction(
  input: CreateProductInput
): Promise<ActionResult<ProductWithRelations>> {
  return runAction(() => productService.createProduct(input), [LIST_PATH]);
}

export async function updateProductAction(
  id: string,
  input: UpdateProductInput
): Promise<ActionResult<ProductWithRelations>> {
  return runAction(() => productService.updateProduct(id, input), [
    LIST_PATH,
    `/masters/products/${id}/edit`,
  ]);
}

export async function activateProductAction(
  id: string
): Promise<ActionResult<ProductWithRelations>> {
  return runAction(() => productService.activateProduct(id), [LIST_PATH]);
}

export async function deactivateProductAction(
  id: string
): Promise<ActionResult<ProductWithRelations>> {
  return runAction(() => productService.deactivateProduct(id), [LIST_PATH]);
}
