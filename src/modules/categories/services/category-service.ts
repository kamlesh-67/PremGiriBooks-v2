import { AppError } from "@/lib/app-error";
import { getCurrentCompanyUser } from "@/lib/current-user";
import { assertPermission } from "@/lib/permissions";
import { isUniqueConstraintError } from "@/lib/prisma-errors";
import {
  categoryRepository,
  type CategoryPersistData,
} from "@/modules/categories/repositories/category-repository";
import { buildCategoryTree } from "@/modules/categories/utils/category-tree";
import {
  createCategorySchema,
  updateCategorySchema,
  type CreateCategoryInput,
  type UpdateCategoryInput,
} from "@/modules/categories/validation/category-schema";
import type { Category, CategoryListFilters, CategoryNode } from "@/types/category";

// The permission catalog (11-role-permissions.md) has no dedicated
// activate/deactivate action, only view/create/edit/delete/approve/export —
// Activate and Deactivate both gate on "delete", the documented convention
// since ledger-service.ts.
const LIFECYCLE_ACTION = "delete";

function translatePersistError(error: unknown): never {
  if (isUniqueConstraintError(error, "name")) {
    throw new AppError("A category with this name already exists in this company.");
  }
  throw error;
}

function toPersistData(data: CreateCategoryInput): CategoryPersistData {
  return {
    name: data.name,
    parentCategoryId: data.parentCategoryId ?? null,
    description: data.description ?? null,
  };
}

export const categoryService = {
  async listCategories(filters: CategoryListFilters = {}): Promise<Category[]> {
    const user = await getCurrentCompanyUser();
    await assertPermission(user, "masters", "view");
    return categoryRepository.findMany(user.companyId, filters);
  },

  /** Parent → children hierarchy for the tree UI, mirroring the Ledger Group Tree. */
  async getCategoryTree(filters: CategoryListFilters = {}): Promise<CategoryNode[]> {
    const user = await getCurrentCompanyUser();
    await assertPermission(user, "masters", "view");
    const categories = await categoryRepository.findMany(user.companyId, filters);
    return buildCategoryTree(categories);
  },

  /**
   * Active categories for the current company — the flat lookup Product
   * Management (phase-tracker #23) will consume for its Category picker,
   * and the parent-picker's source list.
   */
  async listSelectableCategories(): Promise<Category[]> {
    const user = await getCurrentCompanyUser();
    await assertPermission(user, "masters", "view");
    return categoryRepository.findMany(user.companyId, { status: "active" });
  },

  // A category belonging to a different company must resolve identically to
  // "not found" — never distinguish "exists but isn't yours" from "doesn't
  // exist," mirroring unit-service.ts's identical rule.
  async getCategory(id: string): Promise<Category | null> {
    const user = await getCurrentCompanyUser();
    await assertPermission(user, "masters", "view");

    const category = await categoryRepository.findById(id);
    if (!category || category.companyId !== user.companyId) {
      return null;
    }
    return category;
  },

  async createCategory(input: CreateCategoryInput): Promise<Category> {
    const user = await getCurrentCompanyUser();
    await assertPermission(user, "masters", "create");

    const data = createCategorySchema.parse(input);

    // The parent's company-scope/active checks run inside the repository's
    // own transaction, atomically with the insert — see create()'s comment
    // for the deactivation race a service-side read-then-create would allow.
    try {
      const result = await categoryRepository.create(user.companyId, toPersistData(data));
      switch (result.status) {
        case "parent_not_found":
          throw new AppError("Parent category not found.");
        case "parent_inactive":
          throw new AppError("Cannot create a category under an inactive parent category.");
        case "ok":
          return result.category;
      }
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      translatePersistError(error);
    }
  },

  async updateCategory(id: string, input: UpdateCategoryInput): Promise<Category> {
    const user = await getCurrentCompanyUser();
    await assertPermission(user, "masters", "edit");

    const data = updateCategorySchema.parse(input);

    try {
      const result = await categoryRepository.update(id, user.companyId, toPersistData(data));
      switch (result.status) {
        case "not_found":
          throw new AppError("Category not found.");
        case "parent_not_found":
          throw new AppError("Parent category not found.");
        case "parent_inactive":
          throw new AppError("Cannot move a category under an inactive parent category.");
        case "cycle":
          throw new AppError(
            "A category cannot be moved under itself or one of its own sub-categories."
          );
        case "ok":
          return result.category;
      }
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      translatePersistError(error);
    }
  },

  async activateCategory(id: string): Promise<Category> {
    const user = await getCurrentCompanyUser();
    await assertPermission(user, "masters", LIFECYCLE_ACTION);

    const result = await categoryRepository.activate(id, user.companyId);
    switch (result.status) {
      case "not_found":
        throw new AppError("Category not found.");
      case "parent_inactive":
        throw new AppError("Cannot activate a category while its parent category is inactive.");
      case "ok":
        return result.category;
    }
  },

  async deactivateCategory(id: string): Promise<Category> {
    const user = await getCurrentCompanyUser();
    await assertPermission(user, "masters", LIFECYCLE_ACTION);

    const result = await categoryRepository.deactivate(id, user.companyId);
    switch (result.status) {
      case "not_found":
        throw new AppError("Category not found.");
      case "has_active_children":
        throw new AppError(
          "Cannot deactivate a category that has an active sub-category. Deactivate its sub-categories first."
        );
      case "ok":
        return result.category;
    }
  },
};
