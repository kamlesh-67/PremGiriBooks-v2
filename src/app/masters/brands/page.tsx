import Link from "next/link";
import { redirect } from "next/navigation";
import { Plus } from "lucide-react";

import { AppShell } from "@/components/layout/app-shell";
import { Button } from "@/components/ui/button";
import { getCurrentCompanyUser } from "@/lib/current-user";
import { hasPermission, isCurrentUserCompanyAdmin } from "@/lib/permissions";
import { brandService } from "@/modules/brands/services/brand-service";
import { BrandTable } from "@/modules/brands/components/brand-table";

export default async function BrandListPage() {
  const user = await getCurrentCompanyUser();
  const canView = await hasPermission(user, "masters", "view");
  if (!canView) {
    redirect("/");
  }

  const [brands, isAdmin, canCreate, canEdit, canManage] = await Promise.all([
    brandService.listBrands(),
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
            <h1 className="text-xl font-semibold text-foreground">Brands</h1>
            <p className="text-sm text-muted-foreground">
              Manage the product brands and manufacturers your products will reference.
            </p>
          </div>
          {canCreate ? (
            <Button
              nativeButton={false}
              render={
                <Link href="/masters/brands/new">
                  <Plus size={18} />
                  New Brand
                </Link>
              }
            />
          ) : null}
        </div>

        <BrandTable brands={brands} canEdit={canEdit} canManage={canManage} />
      </div>
    </AppShell>
  );
}
