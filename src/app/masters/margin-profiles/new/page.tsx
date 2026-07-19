import { redirect } from "next/navigation";

import { AppShell } from "@/components/layout/app-shell";
import { getCurrentCompanyUser } from "@/lib/current-user";
import { hasPermission, isCurrentUserCompanyAdmin } from "@/lib/permissions";
import { MarginProfileForm } from "@/modules/margin-profiles/components/margin-profile-form";

export default async function NewMarginProfilePage() {
  const user = await getCurrentCompanyUser();
  const canCreate = await hasPermission(user, "masters", "create");
  if (!canCreate) {
    redirect("/masters/margin-profiles");
  }

  const isAdmin = await isCurrentUserCompanyAdmin();

  return (
    <AppShell isAdmin={isAdmin}>
      <div className="flex flex-col gap-6 p-6">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Create Margin Profile</h1>
          <p className="text-sm text-muted-foreground">
            Add a named margin or markup pricing rule with a percentage per customer tier.
          </p>
        </div>

        <MarginProfileForm />
      </div>
    </AppShell>
  );
}
