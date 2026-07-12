import Link from "next/link";
import { redirect } from "next/navigation";

import { Button } from "@/components/ui/button";
import { getCurrentCompany } from "@/lib/current-company";
import { financialYearService } from "@/modules/financial-year/services/financial-year-service";
import { FinancialYearSelector } from "@/modules/financial-year/components/financial-year-selector";

export default async function FinancialYearSelectPage() {
  const company = await getCurrentCompany();
  if (!company) {
    redirect("/company/select");
  }

  const financialYears = await financialYearService.listSelectableFinancialYears(company.id);

  if (financialYears.length === 0) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background p-6 text-center">
        <h1 className="text-xl font-semibold text-foreground">No financial years yet</h1>
        <p className="max-w-sm text-sm text-muted-foreground">
          Create a financial year for {company.displayName ?? company.companyName} to get started.
        </p>
        <Button
          nativeButton={false}
          render={<Link href="/financial-year/new">Create Financial Year</Link>}
        />
      </main>
    );
  }

  return (
    <main className="flex min-h-screen flex-col items-center gap-8 bg-background p-6 py-16">
      <div className="text-center">
        <h1 className="text-xl font-semibold text-foreground">Select a Financial Year</h1>
        <p className="text-sm text-muted-foreground">
          Choose the financial year you want to work with.
        </p>
      </div>
      <div className="w-full max-w-4xl">
        <FinancialYearSelector financialYears={financialYears} />
      </div>
    </main>
  );
}
