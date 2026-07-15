"use server";

import { runAction } from "@/lib/run-action";
import { categoryService } from "@/modules/categories/services/category-service";
import type {
  CreateCategoryInput,
  UpdateCategoryInput,
} from "@/modules/categories/validation/category-schema";
import type { ActionResult } from "@/types/api";
import type { Category } from "@/types/category";

const LIST_PATH = "/masters/categories";

export async function createCategoryAction(
  input: CreateCategoryInput
): Promise<ActionResult<Category>> {
  return runAction(() => categoryService.createCategory(input), [LIST_PATH]);
}

export async function updateCategoryAction(
  id: string,
  input: UpdateCategoryInput
): Promise<ActionResult<Category>> {
  return runAction(() => categoryService.updateCategory(id, input), [
    LIST_PATH,
    `/masters/categories/${id}/edit`,
  ]);
}

export async function activateCategoryAction(id: string): Promise<ActionResult<Category>> {
  return runAction(() => categoryService.activateCategory(id), [LIST_PATH]);
}

export async function deactivateCategoryAction(id: string): Promise<ActionResult<Category>> {
  return runAction(() => categoryService.deactivateCategory(id), [LIST_PATH]);
}
