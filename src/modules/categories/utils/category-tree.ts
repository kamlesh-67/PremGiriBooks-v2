import type { Category, CategoryNode } from "@/types/category";

/**
 * Builds a parent/child tree from a flat, company-scoped list of categories,
 * mirroring ledger-group-tree.ts. A node whose parent is missing from the
 * list (e.g. filtered out) is promoted to a root rather than dropped.
 */
export function buildCategoryTree(categories: Category[]): CategoryNode[] {
  const nodeById = new Map<string, CategoryNode>();
  for (const category of categories) {
    nodeById.set(category.id, { ...category, children: [] });
  }

  const roots: CategoryNode[] = [];
  for (const node of nodeById.values()) {
    if (node.parentCategoryId && nodeById.has(node.parentCategoryId)) {
      nodeById.get(node.parentCategoryId)!.children.push(node);
    } else {
      roots.push(node);
    }
  }

  return roots;
}

/**
 * Ids of every descendant of `rootId` within the given flat list (the root
 * itself is not included). Shared by the repository's re-parent cycle check
 * (a category's new parent may not be itself or any of its descendants) and
 * the edit form's parent-picker exclusion. Pure and iterative — a corrupted
 * cyclic chain can't send it into infinite recursion because each node is
 * visited at most once.
 */
export function collectDescendantIds(
  categories: readonly Pick<Category, "id" | "parentCategoryId">[],
  rootId: string
): Set<string> {
  const childrenByParent = new Map<string, string[]>();
  for (const category of categories) {
    if (!category.parentCategoryId) {
      continue;
    }
    const siblings = childrenByParent.get(category.parentCategoryId);
    if (siblings) {
      siblings.push(category.id);
    } else {
      childrenByParent.set(category.parentCategoryId, [category.id]);
    }
  }

  const descendants = new Set<string>();
  const queue = [...(childrenByParent.get(rootId) ?? [])];
  while (queue.length > 0) {
    const id = queue.pop()!;
    if (descendants.has(id)) {
      continue;
    }
    descendants.add(id);
    queue.push(...(childrenByParent.get(id) ?? []));
  }

  return descendants;
}
