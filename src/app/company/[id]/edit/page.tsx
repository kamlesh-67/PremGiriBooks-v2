import { notFound } from "next/navigation";

import { AppShell } from "@/components/layout/app-shell";
import { isCurrentUserCompanyAdmin } from "@/lib/permissions";
import { companyService } from "@/modules/company/services/company-service";
import { CompanySettingsForm } from "@/modules/company/components/company-settings-form";
import { companySettingsSchema } from "@/modules/company/validation/company-schema";

interface EditCompanyPageProps {
  params: Promise<{ id: string }>;
}

// Legal/business info editing moved to
// /administration/companies/[id]/edit (Super-Admin-only, per the Company
// Module split) — this page is now Company Admin's operational-settings
// screen only (theme/date format/currency display/logo).
export default async function EditCompanyPage({ params }: EditCompanyPageProps) {
  const { id } = await params;
  const company = await companyService.getCompany(id);

  if (!company) {
    notFound();
  }

  const settingsParseResult = company.settings
    ? companySettingsSchema.safeParse(company.settings)
    : undefined;
  const settingsDefaults = settingsParseResult?.success ? settingsParseResult.data : undefined;
  const isAdmin = await isCurrentUserCompanyAdmin();

  return (
    <AppShell isAdmin={isAdmin}>
      <div className="flex flex-col gap-6 p-6">
        <div>
          <h1 className="text-xl font-semibold text-foreground">
            Company Settings — {company.companyName}
          </h1>
          <p className="text-sm text-muted-foreground">
            Update operational preferences. Legal/business info is managed by Super Admin.
          </p>
        </div>

        {settingsDefaults ? (
          <CompanySettingsForm companyId={company.id} defaultValues={settingsDefaults} />
        ) : (
          <p className="text-sm text-muted-foreground">
            Company settings are still initializing. Please try again shortly.
          </p>
        )}
      </div>
    </AppShell>
  );
}
