import { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { runInTransaction } from "@/lib/transaction";
import { isRecordNotFoundError, isRetryableTransactionError } from "@/lib/prisma-errors";
import { collectDescendantIds } from "@/modules/categories/utils/category-tree";
import type {
  ActivateCategoryResult,
  Category,
  CategoryListFilters,
  CreateCategoryResult,
  DeactivateCategoryResult,
  UpdateCategoryResult,
} from "@/types/category";

const SERIALIZABLE_RETRY = {
  isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
  retryable: isRetryableTransactionError,
  conflictMessage: "This category was changed by another request. Please try again.",
};

export interface CategoryPersistData {
  name: string;
  parentCategoryId: string | null;
  description: string | null;
}

function buildWhere(companyId: string, filters: CategoryListFilters): Prisma.CategoryWhereInput {
  const where: Prisma.CategoryWhereInput = { companyId };

  if (filters.status === "active") {
    where.isActive = true;
  } else if (filters.status === "inactive") {
    where.isActive = false;
  }

  if (filters.search) {
    where.name = { contains: filters.search, mode: "insensitive" };
  }

  return where;
}

export const categoryRepository = {
  findMany(companyId: string, filters: CategoryListFilters = {}): Promise<Category[]> {
    return prisma.category.findMany({
      where: buildWhere(companyId, filters),
      orderBy: { name: "asc" },
    });
  },

  findById(id: string): Promise<Category | null> {
    return prisma.category.findUnique({ where: { id } });
  },

  // A brand-new category has no descendants, so no cycle check is needed
  // here — but the parent's company-scope/active checks must still be atomic
  // with the insert. A plain read-then-create would race deactivate():
  // a concurrent deactivation of the chosen parent could pass its own "no
  // active children" count (this row not yet inserted) while this create
  // reads the parent as still active, committing an active child under an
  // inactive parent. Both sides run Serializable, so one of the two aborts
  // with P2034 and retries. A parentless create takes the same path for one
  // code shape; it degenerates to a single insert.
  create(companyId: string, data: CategoryPersistData): Promise<CreateCategoryResult> {
    return runInTransaction(async (tx) => {
      if (data.parentCategoryId) {
        const parent = await tx.category.findUnique({ where: { id: data.parentCategoryId } });
        // A parent belonging to a different company resolves identically to
        // "not found" — never reveal cross-company existence.
        if (!parent || parent.companyId !== companyId) {
          return { status: "parent_not_found" };
        }
        if (!parent.isActive) {
          return { status: "parent_inactive" };
        }
      }

      const category = await tx.category.create({ data: { ...data, companyId } });
      return { status: "ok", category };
    }, SERIALIZABLE_RETRY);
  },

  /**
   * Update may re-parent (20-category-management.md's deliberate divergence
   * from Ledger Groups' frozen parentGroupId), which buys back the
   * cycle-prevention obligation: the new parent must not be the category
   * itself or any of its descendants, and the check must be
   * concurrency-safe. The descendant walk, the new-parent-active check, and
   * the write all run in one Serializable + bounded-retry transaction —
   * without Serializable isolation, two concurrent re-parents (A under B, B
   * under A) each pass their own read-check and commit a cycle (classic
   * write skew).
   *
   * The spec permits rename-only writes to skip Serializable, but the client
   * submits parentCategoryId on every update, so any update may re-parent —
   * distinguishing would need a pre-read outside the transaction that itself
   * races. Running the whole path Serializable is strictly safer; when the
   * parent is unchanged the per-request cost is one extra indexed read.
   *
   * When the parent is unchanged, its active status is deliberately NOT
   * re-checked — "active at assignment time" (Business Rules) only applies
   * when the parent is actually (re)assigned. Otherwise renaming a child
   * whose parent was later deactivated would be impossible.
   */
  update(id: string, companyId: string, data: CategoryPersistData): Promise<UpdateCategoryResult> {
    return runInTransaction(async (tx) => {
      const existing = await tx.category.findUnique({ where: { id } });
      if (!existing || existing.companyId !== companyId) {
        return { status: "not_found" };
      }

      const parentChanged = data.parentCategoryId !== existing.parentCategoryId;
      if (parentChanged && data.parentCategoryId) {
        if (data.parentCategoryId === id) {
          return { status: "cycle" };
        }

        const parent = await tx.category.findUnique({ where: { id: data.parentCategoryId } });
        // A parent belonging to a different company resolves identically to
        // "not found" — never reveal cross-company existence.
        if (!parent || parent.companyId !== companyId) {
          return { status: "parent_not_found" };
        }
        if (!parent.isActive) {
          return { status: "parent_inactive" };
        }

        const rows = await tx.category.findMany({
          where: { companyId },
          select: { id: true, parentCategoryId: true },
        });
        if (collectDescendantIds(rows, id).has(data.parentCategoryId)) {
          return { status: "cycle" };
        }
      }

      try {
        const category = await tx.category.update({ where: { id }, data });
        return { status: "ok", category };
      } catch (error) {
        if (isRecordNotFoundError(error)) {
          return { status: "not_found" };
        }
        throw error;
      }
    }, SERIALIZABLE_RETRY);
  },

  // Also checks the parent (if any) is active in the same transaction —
  // reactivating a child under a still-inactive parent would reach exactly
  // the "active child under an inactive parent" state deactivate()'s own
  // "no active children" invariant exists to prevent. Same Serializable +
  // retry protection as deactivate() below, for the mirror image of its
  // race, exactly as ledger-group-repository.ts's activate() documents.
  activate(id: string, companyId: string): Promise<ActivateCategoryResult> {
    return runInTransaction(async (tx) => {
      const existing = await tx.category.findUnique({ where: { id } });
      if (!existing || existing.companyId !== companyId) {
        return { status: "not_found" };
      }

      if (existing.parentCategoryId) {
        const parent = await tx.category.findUnique({
          where: { id: existing.parentCategoryId },
        });
        if (!parent || !parent.isActive) {
          return { status: "parent_inactive" };
        }
      }

      const category = await tx.category.update({ where: { id }, data: { isActive: true } });
      return { status: "ok", category };
    }, SERIALIZABLE_RETRY);
  },

  /**
   * Bundles the tenant-isolation check and the "cannot deactivate a category
   * with an active child" invariant into one Serializable transaction —
   * mirroring ledger-group-repository.ts's identical "count-then-write
   * invariant → Serializable + bounded retry" recipe. Without Serializable
   * isolation, a concurrent request activating (or re-parenting) a child
   * under this category could race past this count check.
   */
  deactivate(id: string, companyId: string): Promise<DeactivateCategoryResult> {
    return runInTransaction(async (tx) => {
      const existing = await tx.category.findUnique({ where: { id } });
      if (!existing || existing.companyId !== companyId) {
        return { status: "not_found" };
      }

      const activeChildren = await tx.category.count({
        where: { parentCategoryId: id, isActive: true },
      });
      if (activeChildren > 0) {
        return { status: "has_active_children" };
      }

      const category = await tx.category.update({ where: { id }, data: { isActive: false } });
      return { status: "ok", category };
    }, SERIALIZABLE_RETRY);
  },
};
