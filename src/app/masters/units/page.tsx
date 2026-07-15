import Link from "next/link";
import { redirect } from "next/navigation";
import { Plus } from "lucide-react";

import { AppShell } from "@/components/layout/app-shell";
import { Button } from "@/components/ui/button";
import { getCurrentCompanyUser } from "@/lib/current-user";
import { hasPermission, isCurrentUserCompanyAdmin } from "@/lib/permissions";
import { unitService } from "@/modules/units/services/unit-service";
import { UnitTable } from "@/modules/units/components/unit-table";

export default async function UnitListPage() {
  const user = await getCurrentCompanyUser();
  const canView = await hasPermission(user, "masters", "view");
  if (!canView) {
    redirect("/");
  }

  const [units, isAdmin, canCreate, canEdit, canManage] = await Promise.all([
    unitService.listUnits(),
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
            <h1 className="text-xl font-semibold text-foreground">Units</h1>
            <p className="text-sm text-muted-foreground">
              Manage the units of measure your products and documents will use.
            </p>
          </div>
          {canCreate ? (
            <Button
              nativeButton={false}
              render={
                <Link href="/masters/units/new">
                  <Plus size={18} />
                  New Unit
                </Link>
              }
            />
          ) : null}
        </div>

        <UnitTable units={units} canEdit={canEdit} canManage={canManage} />
      </div>
    </AppShell>
  );
}
