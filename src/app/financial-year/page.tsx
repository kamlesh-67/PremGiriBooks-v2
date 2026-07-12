import Link from "next/link";
import { redirect } from "next/navigation";
import { Plus } from "lucide-react";

import { AppShell } from "@/components/layout/app-shell";
import { Button } from "@/components/ui/button";
import { getCurrentCompany } from "@/lib/current-company";
import { isCurrentUserAdmin } from "@/lib/current-user";
import { financialYearService } from "@/modules/financial-year/services/financial-year-service";
import { FinancialYearTable } from "@/modules/financial-year/components/financial-year-table";

export default async function FinancialYearListPage() {
  const company = await getCurrentCompany();
  if (!company) {
    redirect("/company/select");
  }

  const financialYears = await financialYearService.listFinancialYears(company.id);
  const isAdmin = await isCurrentUserAdmin();

  return (
    <AppShell isAdmin={isAdmin}>
      <div className="flex flex-col gap-6 p-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-foreground">Financial Years</h1>
            <p className="text-sm text-muted-foreground">
              Manage the financial years for {company.displayName ?? company.companyName}.
            </p>
          </div>
          <Button
            nativeButton={false}
            render={
              <Link href="/financial-year/new">
                <Plus size={18} />
                New Financial Year
              </Link>
            }
          />
        </div>

        <FinancialYearTable financialYears={financialYears} />
      </div>
    </AppShell>
  );
}
