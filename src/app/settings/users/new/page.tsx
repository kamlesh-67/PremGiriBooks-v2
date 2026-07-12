import { redirect } from "next/navigation";

import { AppShell } from "@/components/layout/app-shell";
import { isCurrentUserAdmin } from "@/lib/current-user";
import { userService } from "@/modules/users/services/user-service";
import { UserCreateForm } from "@/modules/users/components/user-create-form";

export default async function NewUserPage() {
  const isAdmin = await isCurrentUserAdmin();
  if (!isAdmin) {
    redirect("/settings/users");
  }

  const roles = await userService.listRoles();

  return (
    <AppShell isAdmin={isAdmin}>
      <div className="flex flex-col gap-6 p-6">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Create User</h1>
          <p className="text-sm text-muted-foreground">
            Add a new user account to your company.
          </p>
        </div>

        <UserCreateForm roles={roles} />
      </div>
    </AppShell>
  );
}
