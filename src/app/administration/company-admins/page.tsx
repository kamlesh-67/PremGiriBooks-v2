import { redirect } from "next/navigation";

import { PlatformShell } from "@/components/layout/platform-shell";
import { isCurrentUserSuperAdmin } from "@/lib/current-user";
import { platformUserService } from "@/modules/administration/services/platform-user-service";
import { CompanyAdminTable } from "@/modules/administration/components/company-admin-table";

export default async function CompanyAdminsPage() {
  const isSuperAdmin = await isCurrentUserSuperAdmin();
  if (!isSuperAdmin) {
    redirect("/");
  }

  const companyAdmins = await platformUserService.listCompanyAdmins();

  return (
    <PlatformShell>
      <div className="flex flex-col gap-6 p-6">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Company Admins</h1>
          <p className="text-sm text-muted-foreground">
            Every company&apos;s Company Admin, across the platform.
          </p>
        </div>

        <CompanyAdminTable companyAdmins={companyAdmins} />
      </div>
    </PlatformShell>
  );
}
