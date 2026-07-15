import { redirect } from "next/navigation";

import { AppShell } from "@/components/layout/app-shell";
import { getCurrentCompanyUser } from "@/lib/current-user";
import { hasPermission, isCurrentUserCompanyAdmin } from "@/lib/permissions";
import { categoryService } from "@/modules/categories/services/category-service";
import { CategoryForm } from "@/modules/categories/components/category-form";

export default async function NewCategoryPage() {
  const user = await getCurrentCompanyUser();
  const canCreate = await hasPermission(user, "masters", "create");
  if (!canCreate) {
    redirect("/masters/categories");
  }

  const [parentOptions, isAdmin] = await Promise.all([
    categoryService.listSelectableCategories(),
    isCurrentUserCompanyAdmin(),
  ]);

  return (
    <AppShell isAdmin={isAdmin}>
      <div className="flex flex-col gap-6 p-6">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Create Category</h1>
          <p className="text-sm text-muted-foreground">
            Add a new product category, optionally under a parent category.
          </p>
        </div>

        <CategoryForm parentOptions={parentOptions} />
      </div>
    </AppShell>
  );
}
