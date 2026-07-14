import { notFound, redirect } from "next/navigation";

import { AppShell } from "@/components/layout/app-shell";
import { getCurrentCompanyUser } from "@/lib/current-user";
import { hasPermission } from "@/lib/permissions";
import { companyService } from "@/modules/company/services/company-service";
import { CompanyProfileForm } from "@/modules/company/components/company-profile-form";
import { toCompanyFormValues } from "@/modules/company/utils/company-form-values";

interface EditCompanyPageProps {
  params: Promise<{ id: string }>;
}

// Legal/registration-identifier editing (Legal Name, GSTIN, PAN, TAN, CIN,
// currency code) stays Super-Admin-only at /administration/companies/[id]/edit
// per the Company Module split — this page is Company Admin's own profile
// screen (everything else, plus logo). Operational settings (theme/date
// format/number format/currency display format) moved to /profile's
// "Company Settings" tab.
export default async function EditCompanyPage({ params }: EditCompanyPageProps) {
  const { id } = await params;

  // getCompany() already scopes a COMPANY user to their own company (returns
  // null otherwise), but that 404s rather than denies — assertPermission is
  // this page's real access-control boundary, matching
  // companyService.updateCompanyProfile's own gate.
  const user = await getCurrentCompanyUser();
  const canEdit = await hasPermission(user, "company", "edit");
  if (!canEdit) {
    redirect("/");
  }

  const company = await companyService.getCompany(id);
  if (!company) {
    notFound();
  }

  const isAdmin = await hasPermission(user, "settings", "view");

  return (
    <AppShell isAdmin={isAdmin}>
      <div className="flex flex-col gap-6 p-6">
        <div>
          <h1 className="text-xl font-semibold text-foreground">
            Company Profile — {company.companyName}
          </h1>
          <p className="text-sm text-muted-foreground">
            Update your company&apos;s profile. Registration identifiers (Legal Name, GSTIN, PAN,
            TAN, CIN) and currency code are managed by Super Admin. Operational preferences (theme,
            date format, etc.) are on your Profile page.
          </p>
        </div>

        <CompanyProfileForm companyId={company.id} defaultValues={toCompanyFormValues(company)} />
      </div>
    </AppShell>
  );
}
