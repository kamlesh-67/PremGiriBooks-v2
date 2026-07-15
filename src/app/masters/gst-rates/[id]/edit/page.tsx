import { notFound, redirect } from "next/navigation";

import { AppShell } from "@/components/layout/app-shell";
import { getCurrentCompanyUser } from "@/lib/current-user";
import { hasPermission, isCurrentUserCompanyAdmin } from "@/lib/permissions";
import { gstRateService } from "@/modules/gst-rates/services/gst-rate-service";
import { GstRateForm } from "@/modules/gst-rates/components/gst-rate-form";

interface EditGstRatePageProps {
  params: Promise<{ id: string }>;
}

export default async function EditGstRatePage({ params }: EditGstRatePageProps) {
  const { id } = await params;

  const user = await getCurrentCompanyUser();
  const canEdit = await hasPermission(user, "masters", "edit");
  if (!canEdit) {
    redirect("/masters/gst-rates");
  }

  const gstRate = await gstRateService.getGstRate(id);
  if (!gstRate) {
    notFound();
  }

  const isAdmin = await isCurrentUserCompanyAdmin();

  return (
    <AppShell isAdmin={isAdmin}>
      <div className="flex flex-col gap-6 p-6">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Edit GST Rate — {gstRate.name}</h1>
          <p className="text-sm text-muted-foreground">
            Update the rate&apos;s name, rate percent, cess percent, and description.
          </p>
        </div>

        <GstRateForm gstRate={gstRate} />
      </div>
    </AppShell>
  );
}
