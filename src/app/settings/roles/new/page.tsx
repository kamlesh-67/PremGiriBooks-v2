import { redirect } from "next/navigation";

import { AppShell } from "@/components/layout/app-shell";
import { isCurrentUserCompanyAdmin } from "@/lib/permissions";
import { RoleCreateForm } from "@/modules/roles/components/role-create-form";

export default async function NewRolePage() {
  const isAdmin = await isCurrentUserCompanyAdmin();
  if (!isAdmin) {
    redirect("/settings/roles");
  }

  return (
    <AppShell isAdmin={isAdmin}>
      <div className="flex flex-col gap-6 p-6">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Create Role</h1>
          <p className="text-sm text-muted-foreground">
            Add a new role. You can assign permissions after creating it.
          </p>
        </div>

        <RoleCreateForm />
      </div>
    </AppShell>
  );
}
