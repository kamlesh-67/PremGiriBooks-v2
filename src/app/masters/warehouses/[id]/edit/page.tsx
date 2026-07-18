import { notFound, redirect } from "next/navigation";

import { AppShell } from "@/components/layout/app-shell";
import { getCurrentCompanyUser } from "@/lib/current-user";
import { hasPermission, isCurrentUserCompanyAdmin } from "@/lib/permissions";
import { warehouseService } from "@/modules/warehouses/services/warehouse-service";
import { WarehouseForm } from "@/modules/warehouses/components/warehouse-form";

interface EditWarehousePageProps {
  params: Promise<{ id: string }>;
}

export default async function EditWarehousePage({ params }: EditWarehousePageProps) {
  const { id } = await params;

  const user = await getCurrentCompanyUser();
  const canEdit = await hasPermission(user, "masters", "edit");
  if (!canEdit) {
    redirect("/masters/warehouses");
  }

  const warehouse = await warehouseService.getWarehouse(id);
  if (!warehouse) {
    notFound();
  }

  const [isAdmin, branchOptions] = await Promise.all([
    isCurrentUserCompanyAdmin(),
    // Includes the warehouse's current branch even if since deactivated, so
    // the stored value stays visible and re-selectable (labeled "(Inactive)").
    warehouseService.listSelectableBranches(warehouse.branchId ?? undefined),
  ]);

  return (
    <AppShell isAdmin={isAdmin}>
      <div className="flex flex-col gap-6 p-6">
        <div>
          <h1 className="text-xl font-semibold text-foreground">
            Edit Warehouse — {warehouse.name}
          </h1>
          <p className="text-sm text-muted-foreground">
            Update the warehouse&apos;s name, code, branch link, address, and contact number.
          </p>
        </div>

        <WarehouseForm warehouse={warehouse} branchOptions={branchOptions} />
      </div>
    </AppShell>
  );
}
