import { notFound, redirect } from "next/navigation";

import { AppShell } from "@/components/layout/app-shell";
import { isCurrentUserAdmin } from "@/lib/current-user";
import { userService } from "@/modules/users/services/user-service";
import { UserEditForm } from "@/modules/users/components/user-edit-form";
import { toUserFormValues } from "@/modules/users/utils/user-form-values";

interface EditUserPageProps {
  params: Promise<{ id: string }>;
}

export default async function EditUserPage({ params }: EditUserPageProps) {
  const isAdmin = await isCurrentUserAdmin();
  if (!isAdmin) {
    redirect("/settings/users");
  }

  const { id } = await params;
  const user = await userService.getUser(id);
  if (!user) {
    notFound();
  }

  const roles = await userService.listRoles();

  return (
    <AppShell isAdmin={isAdmin}>
      <div className="flex flex-col gap-6 p-6">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Edit User — {user.fullName}</h1>
          <p className="text-sm text-muted-foreground">
            Update the user&apos;s profile, role, or password.
          </p>
        </div>

        <UserEditForm userId={user.id} roles={roles} defaultValues={toUserFormValues(user)} />
      </div>
    </AppShell>
  );
}
