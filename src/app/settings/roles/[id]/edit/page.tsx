import { notFound, redirect } from "next/navigation";

import { AppShell } from "@/components/layout/app-shell";
import { isCurrentUserCompanyAdmin } from "@/lib/permissions";
import { PermissionMatrix } from "@/modules/roles/components/permission-matrix";
import { RoleEditForm } from "@/modules/roles/components/role-edit-form";
import { permissionService } from "@/modules/roles/services/permission-service";
import { roleService } from "@/modules/roles/services/role-service";

interface EditRolePageProps {
  params: Promise<{ id: string }>;
}

export default async function EditRolePage({ params }: EditRolePageProps) {
  const isAdmin = await isCurrentUserCompanyAdmin();
  if (!isAdmin) {
    redirect("/settings/roles");
  }

  const { id } = await params;
  const role = await roleService.getRole(id);
  if (!role) {
    notFound();
  }

  const [catalog, assignedPermissionIds] = await Promise.all([
    permissionService.listCatalog(),
    permissionService.getRolePermissionIds(id),
  ]);

  return (
    <AppShell isAdmin={isAdmin}>
      <div className="flex flex-col gap-6 p-6">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Edit Role — {role.name}</h1>
          <p className="text-sm text-muted-foreground">
            Update the role name and its assigned permissions.
          </p>
        </div>

        <RoleEditForm roleId={role.id} defaultValues={{ name: role.name }} />

        <div className="flex flex-col gap-2">
          <h2 className="text-lg font-semibold text-foreground">Permissions</h2>
          <PermissionMatrix
            roleId={role.id}
            catalog={catalog}
            initialAssignedPermissionIds={assignedPermissionIds}
          />
        </div>
      </div>
    </AppShell>
  );
}
