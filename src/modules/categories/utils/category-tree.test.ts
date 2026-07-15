import { describe, expect, it } from "vitest";

import { buildCategoryTree, collectDescendantIds } from "@/modules/categories/utils/category-tree";
import type { Category } from "@/types/category";

function makeCategory(id: string, parentCategoryId: string | null): Category {
  return {
    id,
    companyId: "company-1",
    name: `Category ${id}`,
    parentCategoryId,
    description: null,
    isActive: true,
    createdAt: new Date("2026-07-15T00:00:00Z"),
    updatedAt: new Date("2026-07-15T00:00:00Z"),
  };
}

// root ─┬─ a ─┬─ a1
//       │     └─ a2 ── a2x
//       └─ b
const FIXTURE: Category[] = [
  makeCategory("root", null),
  makeCategory("a", "root"),
  makeCategory("a1", "a"),
  makeCategory("a2", "a"),
  makeCategory("a2x", "a2"),
  makeCategory("b", "root"),
  makeCategory("other-root", null),
];

describe("buildCategoryTree", () => {
  it("nests children under their parents and returns roots", () => {
    const tree = buildCategoryTree(FIXTURE);

    expect(tree.map((node) => node.id)).toEqual(["root", "other-root"]);
    const root = tree[0];
    expect(root.children.map((node) => node.id)).toEqual(["a", "b"]);
    expect(root.children[0].children.map((node) => node.id)).toEqual(["a1", "a2"]);
    expect(root.children[0].children[1].children.map((node) => node.id)).toEqual(["a2x"]);
  });

  it("promotes a node whose parent is missing from the list to a root", () => {
    const tree = buildCategoryTree([makeCategory("orphan", "not-in-list")]);
    expect(tree.map((node) => node.id)).toEqual(["orphan"]);
  });

  it("returns an empty list for no categories", () => {
    expect(buildCategoryTree([])).toEqual([]);
  });
});

describe("collectDescendantIds", () => {
  it("collects every transitive descendant, excluding the root itself", () => {
    const descendants = collectDescendantIds(FIXTURE, "a");
    expect([...descendants].sort()).toEqual(["a1", "a2", "a2x"]);
    expect(descendants.has("a")).toBe(false);
  });

  it("returns an empty set for a leaf", () => {
    expect(collectDescendantIds(FIXTURE, "a2x").size).toBe(0);
  });

  it("returns an empty set for an id not in the list", () => {
    expect(collectDescendantIds(FIXTURE, "missing").size).toBe(0);
  });

  it("terminates on a corrupted cyclic chain instead of looping forever", () => {
    const cyclic = [
      makeCategory("x", "y"),
      makeCategory("y", "x"),
      makeCategory("z", "y"),
    ];
    const descendants = collectDescendantIds(cyclic, "x");
    expect([...descendants].sort()).toEqual(["x", "y", "z"]);
  });
});
