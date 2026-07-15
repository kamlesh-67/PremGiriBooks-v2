import { notFound, redirect } from "next/navigation";

import { AppShell } from "@/components/layout/app-shell";
import { getCurrentCompanyUser } from "@/lib/current-user";
import { hasPermission, isCurrentUserCompanyAdmin } from "@/lib/permissions";
import { unitService } from "@/modules/units/services/unit-service";
import { UnitForm } from "@/modules/units/components/unit-form";

interface EditUnitPageProps {
  params: Promise<{ id: string }>;
}

export default async function EditUnitPage({ params }: EditUnitPageProps) {
  const { id } = await params;

  const user = await getCurrentCompanyUser();
  const canEdit = await hasPermission(user, "masters", "edit");
  if (!canEdit) {
    redirect("/masters/units");
  }

  const unit = await unitService.getUnit(id);
  if (!unit) {
    notFound();
  }

  const isAdmin = await isCurrentUserCompanyAdmin();

  return (
    <AppShell isAdmin={isAdmin}>
      <div className="flex flex-col gap-6 p-6">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Edit Unit — {unit.name}</h1>
          <p className="text-sm text-muted-foreground">
            Update the unit&apos;s name, symbol, UQC code, decimal places, and description.
          </p>
        </div>

        <UnitForm unit={unit} />
      </div>
    </AppShell>
  );
}
