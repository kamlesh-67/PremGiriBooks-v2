import Link from "next/link";
import { redirect } from "next/navigation";
import { Plus } from "lucide-react";

import { AppShell } from "@/components/layout/app-shell";
import { Button } from "@/components/ui/button";
import { getCurrentCompanyUser } from "@/lib/current-user";
import { hasPermission, isCurrentUserCompanyAdmin } from "@/lib/permissions";
import { categoryService } from "@/modules/categories/services/category-service";
import { CategoryTree } from "@/modules/categories/components/category-tree";

export default async function CategoryListPage() {
  const user = await getCurrentCompanyUser();
  const canView = await hasPermission(user, "masters", "view");
  if (!canView) {
    redirect("/");
  }

  const [tree, isAdmin, canCreate, canEdit, canManage] = await Promise.all([
    categoryService.getCategoryTree(),
    isCurrentUserCompanyAdmin(),
    hasPermission(user, "masters", "create"),
    hasPermission(user, "masters", "edit"),
    hasPermission(user, "masters", "delete"),
  ]);

  return (
    <AppShell isAdmin={isAdmin}>
      <div className="flex flex-col gap-6 p-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-foreground">Categories</h1>
            <p className="text-sm text-muted-foreground">
              Manage the product classification tree your products and reports will group by.
            </p>
          </div>
          {canCreate ? (
            <Button
              nativeButton={false}
              render={
                <Link href="/masters/categories/new">
                  <Plus size={18} />
                  New Category
                </Link>
              }
            />
          ) : null}
        </div>

        <CategoryTree nodes={tree} canEdit={canEdit} canManage={canManage} />
      </div>
    </AppShell>
  );
}
