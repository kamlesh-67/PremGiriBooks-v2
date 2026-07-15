import { redirect } from "next/navigation";

import { AppShell } from "@/components/layout/app-shell";
import { getCurrentCompanyUser } from "@/lib/current-user";
import { hasPermission, isCurrentUserCompanyAdmin } from "@/lib/permissions";
import { BrandForm } from "@/modules/brands/components/brand-form";

export default async function NewBrandPage() {
  const user = await getCurrentCompanyUser();
  const canCreate = await hasPermission(user, "masters", "create");
  if (!canCreate) {
    redirect("/masters/brands");
  }

  const isAdmin = await isCurrentUserCompanyAdmin();

  return (
    <AppShell isAdmin={isAdmin}>
      <div className="flex flex-col gap-6 p-6">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Create Brand</h1>
          <p className="text-sm text-muted-foreground">
            Add a new product brand or manufacturer, e.g. a publisher.
          </p>
        </div>

        <BrandForm />
      </div>
    </AppShell>
  );
}
