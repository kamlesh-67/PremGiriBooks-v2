import Link from "next/link";
import { redirect } from "next/navigation";
import { Plus } from "lucide-react";

import { AppShell } from "@/components/layout/app-shell";
import { Button } from "@/components/ui/button";
import { isCurrentUserCompanyAdmin } from "@/lib/permissions";
import { roleService } from "@/modules/roles/services/role-service";
import { RoleTable } from "@/modules/roles/components/role-table";

export default async function RoleListPage() {
  const isAdmin = await isCurrentUserCompanyAdmin();
  if (!isAdmin) {
    redirect("/");
  }

  const roles = await roleService.listRoles();

  return (
    <AppShell isAdmin={isAdmin}>
      <div className="flex flex-col gap-6 p-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-foreground">Roles & Permissions</h1>
            <p className="text-sm text-muted-foreground">
              Manage roles and the permissions each role grants.
            </p>
          </div>
          <Button
            nativeButton={false}
            render={
              <Link href="/settings/roles/new">
                <Plus size={18} />
                New Role
              </Link>
            }
          />
        </div>

        <RoleTable roles={roles} />
      </div>
    </AppShell>
  );
}
