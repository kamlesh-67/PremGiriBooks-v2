import { PlatformShell } from "@/components/layout/platform-shell";
import { requireSuperAdmin } from "@/lib/current-user";
import { companyService } from "@/modules/company/services/company-service";
import { platformUserService } from "@/modules/administration/services/platform-user-service";
import { CompanyAdminTable } from "@/modules/administration/components/company-admin-table";

export default async function CompanyAdminsPage() {
  await requireSuperAdmin();

  const [companyAdmins, companies] = await Promise.all([
    platformUserService.listCompanyAdmins(),
    // Only active companies are valid reassignment targets — an inactive
    // company isn't somewhere a Company Admin can usefully be moved to.
    companyService.listCompanies({ status: "active" }),
  ]);

  return (
    <PlatformShell>
      <div className="flex flex-col gap-6 p-6">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Company Admins</h1>
          <p className="text-sm text-muted-foreground">
            Every company&apos;s Company Admin, across the platform.
          </p>
        </div>

        <CompanyAdminTable companyAdmins={companyAdmins} companies={companies} />
      </div>
    </PlatformShell>
  );
}
