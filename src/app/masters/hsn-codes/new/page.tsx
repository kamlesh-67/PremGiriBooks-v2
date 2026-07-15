import { redirect } from "next/navigation";

import { AppShell } from "@/components/layout/app-shell";
import { getCurrentCompanyUser } from "@/lib/current-user";
import { hasPermission, isCurrentUserCompanyAdmin } from "@/lib/permissions";
import { HsnCodeForm } from "@/modules/hsn-codes/components/hsn-code-form";

export default async function NewHsnCodePage() {
  const user = await getCurrentCompanyUser();
  const canCreate = await hasPermission(user, "masters", "create");
  if (!canCreate) {
    redirect("/masters/hsn-codes");
  }

  const isAdmin = await isCurrentUserCompanyAdmin();

  return (
    <AppShell isAdmin={isAdmin}>
      <div className="flex flex-col gap-6 p-6">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Create HSN/SAC Code</h1>
          <p className="text-sm text-muted-foreground">
            Add an HSN code for goods (e.g. 4901 for printed books) or a SAC code for services.
          </p>
        </div>

        <HsnCodeForm />
      </div>
    </AppShell>
  );
}
