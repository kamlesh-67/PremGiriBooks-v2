import { notFound, redirect } from "next/navigation";

import { AppShell } from "@/components/layout/app-shell";
import { isCurrentUserCompanyAdmin } from "@/lib/permissions";
import { financialYearService } from "@/modules/financial-year/services/financial-year-service";
import { FinancialYearEditForm } from "@/modules/financial-year/components/financial-year-edit-form";
import { toFinancialYearFormValues } from "@/modules/financial-year/utils/financial-year-form-values";

interface EditFinancialYearPageProps {
  params: Promise<{ id: string }>;
}

export default async function EditFinancialYearPage({ params }: EditFinancialYearPageProps) {
  const { id } = await params;
  const financialYear = await financialYearService.getFinancialYear(id);

  if (!financialYear) {
    notFound();
  }

  const isAdmin = await isCurrentUserCompanyAdmin();
  if (!isAdmin) {
    redirect("/financial-year");
  }

  if (financialYear.isClosed) {
    redirect("/financial-year");
  }

  return (
    <AppShell isAdmin={isAdmin}>
      <div className="flex flex-col gap-6 p-6">
        <div>
          <h1 className="text-xl font-semibold text-foreground">
            Edit Financial Year — {financialYear.name}
          </h1>
          <p className="text-sm text-muted-foreground">Update the financial year date range.</p>
        </div>

        <FinancialYearEditForm
          financialYearId={financialYear.id}
          defaultValues={toFinancialYearFormValues(financialYear)}
        />
      </div>
    </AppShell>
  );
}
