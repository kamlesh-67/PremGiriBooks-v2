import { redirect } from "next/navigation";

import { AppShell } from "@/components/layout/app-shell";
import { getCurrentCompanyUser } from "@/lib/current-user";
import { hasPermission, isCurrentUserCompanyAdmin } from "@/lib/permissions";
import { warehouseService } from "@/modules/warehouses/services/warehouse-service";
import { WarehouseForm } from "@/modules/warehouses/components/warehouse-form";

export default async function NewWarehousePage() {
  const user = await getCurrentCompanyUser();
  const canCreate = await hasPermission(user, "masters", "create");
  if (!canCreate) {
    redirect("/masters/warehouses");
  }

  const [isAdmin, branchOptions] = await Promise.all([
    isCurrentUserCompanyAdmin(),
    warehouseService.listSelectableBranches(),
  ]);

  return (
    <AppShell isAdmin={isAdmin}>
      <div className="flex flex-col gap-6 p-6">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Create Warehouse</h1>
          <p className="text-sm text-muted-foreground">
            Add a new stock location, e.g. Main Godown or Retail Store.
          </p>
        </div>

        <WarehouseForm branchOptions={branchOptions} />
      </div>
    </AppShell>
  );
}
