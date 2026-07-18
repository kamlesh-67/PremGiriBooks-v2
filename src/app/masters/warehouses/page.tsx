import Link from "next/link";
import { redirect } from "next/navigation";
import { Plus } from "lucide-react";

import { AppShell } from "@/components/layout/app-shell";
import { Button } from "@/components/ui/button";
import { getCurrentCompanyUser } from "@/lib/current-user";
import { hasPermission, isCurrentUserCompanyAdmin } from "@/lib/permissions";
import { warehouseService } from "@/modules/warehouses/services/warehouse-service";
import { WarehouseTable } from "@/modules/warehouses/components/warehouse-table";

export default async function WarehouseListPage() {
  const user = await getCurrentCompanyUser();
  const canView = await hasPermission(user, "masters", "view");
  if (!canView) {
    redirect("/");
  }

  const [warehouses, isAdmin, canCreate, canEdit, canManage] = await Promise.all([
    warehouseService.listWarehouses(),
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
            <h1 className="text-xl font-semibold text-foreground">Warehouses</h1>
            <p className="text-sm text-muted-foreground">
              Manage the physical stock locations (godowns/stores) your products and stock
              documents will use.
            </p>
          </div>
          {canCreate ? (
            <Button
              nativeButton={false}
              render={
                <Link href="/masters/warehouses/new">
                  <Plus size={18} />
                  New Warehouse
                </Link>
              }
            />
          ) : null}
        </div>

        <WarehouseTable warehouses={warehouses} canEdit={canEdit} canManage={canManage} />
      </div>
    </AppShell>
  );
}
