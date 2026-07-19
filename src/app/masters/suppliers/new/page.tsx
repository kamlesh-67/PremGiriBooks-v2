import { redirect } from "next/navigation";

import { AppShell } from "@/components/layout/app-shell";
import { getCurrentCompanyUser } from "@/lib/current-user";
import { hasPermission, isCurrentUserCompanyAdmin } from "@/lib/permissions";
import { SupplierForm } from "@/modules/suppliers/components/supplier-form";
import { supplierService } from "@/modules/suppliers/services/supplier-service";

export default async function NewSupplierPage() {
  const user = await getCurrentCompanyUser();
  const canCreate = await hasPermission(user, "masters", "create");
  if (!canCreate) {
    redirect("/masters/suppliers");
  }

  // Active "Sundry Creditors"-subtree groups — a single group (the common
  // case: no custom sub-groups) renders as plain text instead of a picker.
  const [isAdmin, groups] = await Promise.all([
    isCurrentUserCompanyAdmin(),
    supplierService.listSelectableLedgerGroupsForSupplier(),
  ]);

  return (
    <AppShell isAdmin={isAdmin}>
      <div className="flex flex-col gap-6 p-6">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Create Supplier</h1>
          <p className="text-sm text-muted-foreground">
            Add a permanent supplier — its ledger under &quot;Sundry Creditors&quot; is created
            with it.
          </p>
        </div>

        <SupplierForm groups={groups} />
      </div>
    </AppShell>
  );
}
