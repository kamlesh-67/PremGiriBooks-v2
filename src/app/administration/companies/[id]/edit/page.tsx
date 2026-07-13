import { notFound, redirect } from "next/navigation";

import { PlatformShell } from "@/components/layout/platform-shell";
import { isCurrentUserSuperAdmin } from "@/lib/current-user";
import { companyService } from "@/modules/company/services/company-service";
import { CompanyEditForm } from "@/modules/company/components/company-edit-form";
import { toCompanyFormValues } from "@/modules/company/utils/company-form-values";

interface EditCompanyPageProps {
  params: Promise<{ id: string }>;
}

// Legal/business info editing — Super-Admin-only, per the Company Module
// split. Operational settings stay at /company/[id]/edit for Company Admin.
export default async function AdministrationEditCompanyPage({ params }: EditCompanyPageProps) {
  const isSuperAdmin = await isCurrentUserSuperAdmin();
  if (!isSuperAdmin) {
    redirect("/");
  }

  const { id } = await params;
  const company = await companyService.getCompany(id);

  if (!company) {
    notFound();
  }

  return (
    <PlatformShell>
      <div className="flex flex-col gap-6 p-6">
        <div>
          <h1 className="text-xl font-semibold text-foreground">
            Edit Company — {company.companyName}
          </h1>
          <p className="text-sm text-muted-foreground">Update legal and business information.</p>
        </div>

        <CompanyEditForm companyId={company.id} defaultValues={toCompanyFormValues(company)} />
      </div>
    </PlatformShell>
  );
}
