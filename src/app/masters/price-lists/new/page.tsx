import { redirect } from "next/navigation";

import { AppShell } from "@/components/layout/app-shell";
import { getCurrentCompanyUser } from "@/lib/current-user";
import { hasPermission, isCurrentUserCompanyAdmin } from "@/lib/permissions";
import { PriceListForm } from "@/modules/price-lists/components/price-list-form";

export default async function NewPriceListPage() {
  const user = await getCurrentCompanyUser();
  const canCreate = await hasPermission(user, "masters", "create");
  if (!canCreate) {
    redirect("/masters/price-lists");
  }

  const isAdmin = await isCurrentUserCompanyAdmin();

  return (
    <AppShell isAdmin={isAdmin}>
      <div className="flex flex-col gap-6 p-6">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Create Price List</h1>
          <p className="text-sm text-muted-foreground">
            Add the list&apos;s name, optional customer tier, and effective window. Item rows are
            added on the next screen.
          </p>
        </div>

        <PriceListForm />
      </div>
    </AppShell>
  );
}
