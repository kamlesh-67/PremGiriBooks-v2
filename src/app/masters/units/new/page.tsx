import { redirect } from "next/navigation";

import { AppShell } from "@/components/layout/app-shell";
import { getCurrentCompanyUser } from "@/lib/current-user";
import { hasPermission, isCurrentUserCompanyAdmin } from "@/lib/permissions";
import { UnitForm } from "@/modules/units/components/unit-form";

export default async function NewUnitPage() {
  const user = await getCurrentCompanyUser();
  const canCreate = await hasPermission(user, "masters", "create");
  if (!canCreate) {
    redirect("/masters/units");
  }

  const isAdmin = await isCurrentUserCompanyAdmin();

  return (
    <AppShell isAdmin={isAdmin}>
      <div className="flex flex-col gap-6 p-6">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Create Unit</h1>
          <p className="text-sm text-muted-foreground">
            Add a new unit of measure, e.g. Pieces, Kilograms, or Boxes.
          </p>
        </div>

        <UnitForm />
      </div>
    </AppShell>
  );
}
