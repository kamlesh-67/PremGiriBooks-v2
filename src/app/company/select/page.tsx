import { Button } from "@/components/ui/button";
import { companyService } from "@/modules/company/services/company-service";
import { CompanySelector } from "@/modules/company/components/company-selector";
import { logoutAction } from "@/lib/auth-actions";

export default async function CompanySelectPage() {
  const companies = await companyService.listCompanies({ status: "active" });

  if (companies.length === 0) {
    // A COMPANY user only ever sees their own single company here
    // (companyService.listCompanies scopes to user.companyId for
    // non-PLATFORM callers) — so an empty result means that company has
    // been deactivated, not that no company exists yet. Company creation
    // is exclusively a Super Admin action (/administration/companies/new)
    // since the platform/company split, so there is nothing for this user
    // to create — only sign out and wait for their Super Admin.
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background p-6 text-center">
        <h1 className="text-xl font-semibold text-foreground">No active company</h1>
        <p className="max-w-sm text-sm text-muted-foreground">
          Your company is not currently active. Please contact your Super Admin to restore
          access.
        </p>
        <form action={logoutAction}>
          <Button type="submit">Sign Out</Button>
        </form>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen flex-col items-center gap-8 bg-background p-6 py-16">
      <div className="text-center">
        <h1 className="text-xl font-semibold text-foreground">Select a Company</h1>
        <p className="text-sm text-muted-foreground">
          Choose the company you want to work with.
        </p>
      </div>
      <div className="w-full max-w-4xl">
        <CompanySelector companies={companies} />
      </div>
    </main>
  );
}
