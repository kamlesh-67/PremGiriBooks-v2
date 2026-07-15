import Link from "next/link";
import { redirect } from "next/navigation";
import { Plus } from "lucide-react";

import { AppShell } from "@/components/layout/app-shell";
import { Button } from "@/components/ui/button";
import { getCurrentCompanyUser } from "@/lib/current-user";
import { hasPermission, isCurrentUserCompanyAdmin } from "@/lib/permissions";
import { gstRateService } from "@/modules/gst-rates/services/gst-rate-service";
import { GstRateTable } from "@/modules/gst-rates/components/gst-rate-table";

export default async function GstRateListPage() {
  const user = await getCurrentCompanyUser();
  const canView = await hasPermission(user, "masters", "view");
  if (!canView) {
    redirect("/");
  }

  const [gstRates, isAdmin, canCreate, canEdit, canManage] = await Promise.all([
    gstRateService.listGstRates(),
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
            <h1 className="text-xl font-semibold text-foreground">GST Rates</h1>
            <p className="text-sm text-muted-foreground">
              Manage the GST rate slabs your products and documents will use.
            </p>
          </div>
          {canCreate ? (
            <Button
              nativeButton={false}
              render={
                <Link href="/masters/gst-rates/new">
                  <Plus size={18} />
                  New GST Rate
                </Link>
              }
            />
          ) : null}
        </div>

        <GstRateTable gstRates={gstRates} canEdit={canEdit} canManage={canManage} />
      </div>
    </AppShell>
  );
}
