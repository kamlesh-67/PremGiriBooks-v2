import type { Category as PrismaCategory } from "@prisma/client";

// Like Unit, a Category has no Decimal columns, so the Prisma row is already
// serializable across the Server Component / Server Action boundary as-is.
export type Category = PrismaCategory;

export type CategoryStatusFilter = "all" | "active" | "inactive";

export interface CategoryListFilters {
  search?: string;
  status?: CategoryStatusFilter;
}

export interface CategoryNode extends Category {
  children: CategoryNode[];
}

export type CreateCategoryResult =
  | { status: "parent_not_found" }
  | { status: "parent_inactive" }
  | { status: "ok"; category: Category };

export type UpdateCategoryResult =
  | { status: "not_found" }
  | { status: "parent_not_found" }
  | { status: "parent_inactive" }
  | { status: "cycle" }
  | { status: "ok"; category: Category };

export type ActivateCategoryResult =
  | { status: "not_found" }
  | { status: "parent_inactive" }
  | { status: "ok"; category: Category };

export type DeactivateCategoryResult =
  | { status: "not_found" }
  | { status: "has_active_children" }
  | { status: "ok"; category: Category };
