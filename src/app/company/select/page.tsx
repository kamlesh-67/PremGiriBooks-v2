import Link from "next/link";

import { Button } from "@/components/ui/button";
import { companyService } from "@/modules/company/services/company-service";
import { CompanySelector } from "@/modules/company/components/company-selector";

export default async function CompanySelectPage() {
  const companies = await companyService.listCompanies({ status: "active" });

  if (companies.length === 0) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background p-6 text-center">
        <h1 className="text-xl font-semibold text-foreground">No companies yet</h1>
        <p className="max-w-sm text-sm text-muted-foreground">
          Create your first company to get started with Premgiri Books ERP.
        </p>
        <Button nativeButton={false} render={<Link href="/company/new">Create Company</Link>} />
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
