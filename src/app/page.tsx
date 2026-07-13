import { redirect } from "next/navigation";

import { AppShell } from "@/components/layout/app-shell";
import { getCurrentCompany } from "@/lib/current-company";
import { getCurrentFinancialYear } from "@/lib/current-financial-year";
import { isCurrentUserCompanyAdmin } from "@/lib/permissions";

export default async function Home() {
  const company = await getCurrentCompany();

  if (!company) {
    redirect("/company/select");
  }

  const financialYear = await getCurrentFinancialYear();

  if (!financialYear) {
    redirect("/financial-year/select");
  }

  const isAdmin = await isCurrentUserCompanyAdmin();

  return (
    <AppShell isAdmin={isAdmin}>
      <div className="flex h-full items-center justify-center">
        <p className="text-sm text-muted-foreground">
          Premgiri Books ERP — application shell ready.
        </p>
      </div>
    </AppShell>
  );
}
