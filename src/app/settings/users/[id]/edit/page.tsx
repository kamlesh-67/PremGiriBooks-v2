import { notFound, redirect } from "next/navigation";

import { AppShell } from "@/components/layout/app-shell";
import { isCurrentUserCompanyAdmin } from "@/lib/permissions";
import { userService } from "@/modules/users/services/user-service";
import { UserEditForm } from "@/modules/users/components/user-edit-form";
import { toUserFormValues } from "@/modules/users/utils/user-form-values";

interface EditUserPageProps {
  params: Promise<{ id: string }>;
}

export default async function EditUserPage({ params }: EditUserPageProps) {
  const isAdmin = await isCurrentUserCompanyAdmin();
  if (!isAdmin) {
    redirect("/settings/users");
  }

  const { id } = await params;
  const [user, roles] = await Promise.all([userService.getUser(id), userService.listRoles()]);
  if (!user) {
    notFound();
  }

  // listRoles() only returns active roles (per 11-role-permissions.md), but
  // this user may already be assigned one that's since been deactivated —
  // the Role Select still needs an entry for it so the current value renders
  // correctly, even though it won't be offered for a *new* assignment.
  const rolesForSelect = roles.some((role) => role.id === user.roleId) ? roles : [...roles, user.role];

  return (
    <AppShell isAdmin={isAdmin}>
      <div className="flex flex-col gap-6 p-6">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Edit User — {user.fullName}</h1>
          <p className="text-sm text-muted-foreground">
            Update the user&apos;s profile, role, or password.
          </p>
        </div>

        <UserEditForm userId={user.id} roles={rolesForSelect} defaultValues={toUserFormValues(user)} />
      </div>
    </AppShell>
  );
}
