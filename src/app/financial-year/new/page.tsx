import { redirect } from "next/navigation";

import { AppShell } from "@/components/layout/app-shell";
import { getCurrentCompany } from "@/lib/current-company";
import { isCurrentUserCompanyAdmin } from "@/lib/permissions";
import { FinancialYearForm } from "@/modules/financial-year/components/financial-year-form";
import { createFinancialYearAction } from "@/modules/financial-year/actions/financial-year-actions";

export default async function NewFinancialYearPage() {
  const company = await getCurrentCompany();
  if (!company) {
    redirect("/company/select");
  }

  const isAdmin = await isCurrentUserCompanyAdmin();
  if (!isAdmin) {
    redirect("/financial-year");
  }

  return (
    <AppShell isAdmin={isAdmin}>
      <div className="flex flex-col gap-6 p-6">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Create Financial Year</h1>
          <p className="text-sm text-muted-foreground">
            Add a new financial year for {company.displayName ?? company.companyName}.
          </p>
        </div>

        <FinancialYearForm onSubmit={createFinancialYearAction} submitLabel="Create Financial Year" />
      </div>
    </AppShell>
  );
}
