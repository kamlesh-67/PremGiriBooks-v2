import { notFound, redirect } from "next/navigation";

import { AppShell } from "@/components/layout/app-shell";
import { getCurrentCompanyUser } from "@/lib/current-user";
import { hasPermission, isCurrentUserCompanyAdmin } from "@/lib/permissions";
import { categoryService } from "@/modules/categories/services/category-service";
import { collectDescendantIds } from "@/modules/categories/utils/category-tree";
import { CategoryForm } from "@/modules/categories/components/category-form";

interface EditCategoryPageProps {
  params: Promise<{ id: string }>;
}

export default async function EditCategoryPage({ params }: EditCategoryPageProps) {
  const { id } = await params;

  const user = await getCurrentCompanyUser();
  const canEdit = await hasPermission(user, "masters", "edit");
  if (!canEdit) {
    redirect("/masters/categories");
  }

  const category = await categoryService.getCategory(id);
  if (!category) {
    notFound();
  }

  const [selectable, isAdmin] = await Promise.all([
    categoryService.listSelectableCategories(),
    isCurrentUserCompanyAdmin(),
  ]);

  // The parent picker must exclude the category being edited and its
  // descendants (the no-cycle rule — the server re-verifies regardless).
  // Computing descendants within the active-only list is sufficient: the
  // activation invariants guarantee an inactive category has no active
  // descendants, so every active descendant is reachable through active
  // links.
  const excluded = collectDescendantIds(selectable, category.id);
  excluded.add(category.id);
  const parentOptions = selectable.filter((option) => !excluded.has(option.id));

  // Edge case: the current parent was deactivated after assignment (allowed —
  // deactivation only blocks on *active* children). Keep it pickable so the
  // stored value stays visible and a rename doesn't force a re-parent; the
  // selector marks it "(Inactive)".
  if (category.parentCategoryId && !parentOptions.some((o) => o.id === category.parentCategoryId)) {
    const currentParent = await categoryService.getCategory(category.parentCategoryId);
    if (currentParent) {
      parentOptions.unshift(currentParent);
    }
  }

  return (
    <AppShell isAdmin={isAdmin}>
      <div className="flex flex-col gap-6 p-6">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Edit Category — {category.name}</h1>
          <p className="text-sm text-muted-foreground">
            Update the category&apos;s name, parent, and description.
          </p>
        </div>

        <CategoryForm category={category} parentOptions={parentOptions} />
      </div>
    </AppShell>
  );
}
