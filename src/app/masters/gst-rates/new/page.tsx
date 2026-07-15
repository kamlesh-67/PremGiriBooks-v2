import { redirect } from "next/navigation";

import { AppShell } from "@/components/layout/app-shell";
import { getCurrentCompanyUser } from "@/lib/current-user";
import { hasPermission, isCurrentUserCompanyAdmin } from "@/lib/permissions";
import { GstRateForm } from "@/modules/gst-rates/components/gst-rate-form";

export default async function NewGstRatePage() {
  const user = await getCurrentCompanyUser();
  const canCreate = await hasPermission(user, "masters", "create");
  if (!canCreate) {
    redirect("/masters/gst-rates");
  }

  const isAdmin = await isCurrentUserCompanyAdmin();

  return (
    <AppShell isAdmin={isAdmin}>
      <div className="flex flex-col gap-6 p-6">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Create GST Rate</h1>
          <p className="text-sm text-muted-foreground">
            Add a new GST rate slab, e.g. GST 18% or Exempt.
          </p>
        </div>

        <GstRateForm />
      </div>
    </AppShell>
  );
}
