import Link from "next/link";
import { Plus } from "lucide-react";

import { PlatformShell } from "@/components/layout/platform-shell";
import { Button } from "@/components/ui/button";
import { requireSuperAdmin } from "@/lib/current-user";
import { companyService } from "@/modules/company/services/company-service";
import { CompanySearchForm } from "@/modules/company/components/company-search-form";
import { CompanyTable } from "@/modules/company/components/company-table";
import type { CompanyStatusFilter } from "@/types/company";

function normalizeStatus(value: string | undefined): CompanyStatusFilter {
  return value === "active" || value === "inactive" ? value : "all";
}

interface AdministrationCompaniesPageProps {
  searchParams: Promise<{ search?: string; status?: string }>;
}

export default async function AdministrationCompaniesPage({
  searchParams,
}: AdministrationCompaniesPageProps) {
  await requireSuperAdmin();

  const params = await searchParams;
  const search = params.search ?? "";
  const status = normalizeStatus(params.status);

  const companies = await companyService.listCompanies({
    search: search || undefined,
    status,
  });

  return (
    <PlatformShell>
      <div className="flex flex-col gap-6 p-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-foreground">Companies</h1>
            <p className="text-sm text-muted-foreground">Manage every company on the platform.</p>
          </div>
          <Button
            nativeButton={false}
            render={
              <Link href="/administration/companies/new">
                <Plus size={18} />
                New Company
              </Link>
            }
          />
        </div>

        <CompanySearchForm
          initialSearch={search}
          initialStatus={status}
          basePath="/administration/companies"
        />

        <CompanyTable
          companies={companies}
          canManageStatus
          canEdit
          editBasePath="/administration/companies"
        />
      </div>
    </PlatformShell>
  );
}
