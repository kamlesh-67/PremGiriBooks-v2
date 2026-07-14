import { AppShell } from "@/components/layout/app-shell";
import { isCurrentUserCompanyAdmin } from "@/lib/permissions";
import { companyService } from "@/modules/company/services/company-service";
import { CompanySearchForm } from "@/modules/company/components/company-search-form";
import { CompanyTable } from "@/modules/company/components/company-table";
import type { CompanyStatusFilter } from "@/types/company";

function normalizeStatus(value: string | undefined): CompanyStatusFilter {
  return value === "active" || value === "inactive" ? value : "all";
}

interface CompanyListPageProps {
  searchParams: Promise<{ search?: string; status?: string }>;
}

export default async function CompanyListPage({ searchParams }: CompanyListPageProps) {
  const params = await searchParams;
  const search = params.search ?? "";
  const status = normalizeStatus(params.status);

  const companies = await companyService.listCompanies({
    search: search || undefined,
    status,
  });
  const isAdmin = await isCurrentUserCompanyAdmin();

  return (
    <AppShell isAdmin={isAdmin}>
      <div className="flex flex-col gap-6 p-6">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Company</h1>
          <p className="text-sm text-muted-foreground">
            View your company profile. Legal/business info is managed by Super Admin.
          </p>
        </div>

        <CompanySearchForm initialSearch={search} initialStatus={status} />

        <CompanyTable companies={companies} canEdit={isAdmin} editBasePath="/company" />
      </div>
    </AppShell>
  );
}
