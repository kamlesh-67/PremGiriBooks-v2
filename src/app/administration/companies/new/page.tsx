import { PlatformShell } from "@/components/layout/platform-shell";
import { requireSuperAdmin } from "@/lib/current-user";
import { CreateCompanyForm } from "@/modules/administration/components/create-company-form";

export default async function NewCompanyPage() {
  await requireSuperAdmin();

  return (
    <PlatformShell>
      <div className="flex flex-col gap-6 p-6">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Create Company</h1>
          <p className="text-sm text-muted-foreground">
            Sets up the company, its first Company Admin, default roles, and financial year —
            all in one step.
          </p>
        </div>

        <CreateCompanyForm />
      </div>
    </PlatformShell>
  );
}
