import { AppShell } from "@/components/layout/app-shell";
import { isCurrentUserAdmin } from "@/lib/current-user";
import { CompanyForm } from "@/modules/company/components/company-form";
import { createCompanyAction } from "@/modules/company/actions/company-actions";

export default async function NewCompanyPage() {
  const isAdmin = await isCurrentUserAdmin();

  return (
    <AppShell isAdmin={isAdmin}>
      <div className="flex flex-col gap-6 p-6">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Create Company</h1>
          <p className="text-sm text-muted-foreground">
            Add a new company to your ERP.
          </p>
        </div>

        <CompanyForm onSubmit={createCompanyAction} submitLabel="Create Company" />
      </div>
    </AppShell>
  );
}
