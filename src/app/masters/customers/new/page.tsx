import { redirect } from "next/navigation";

import { AppShell } from "@/components/layout/app-shell";
import { getCurrentCompanyUser } from "@/lib/current-user";
import { hasPermission, isCurrentUserCompanyAdmin } from "@/lib/permissions";
import { CustomerForm } from "@/modules/customers/components/customer-form";
import { customerService } from "@/modules/customers/services/customer-service";

export default async function NewCustomerPage() {
  const user = await getCurrentCompanyUser();
  const canCreate = await hasPermission(user, "masters", "create");
  if (!canCreate) {
    redirect("/masters/customers");
  }

  // Active "Sundry Debtors"-subtree groups — a single group (the common
  // case: no custom sub-groups) renders as plain text instead of a picker.
  const [isAdmin, groups] = await Promise.all([
    isCurrentUserCompanyAdmin(),
    customerService.listSelectableLedgerGroupsForCustomer(),
  ]);

  return (
    <AppShell isAdmin={isAdmin}>
      <div className="flex flex-col gap-6 p-6">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Create Customer</h1>
          <p className="text-sm text-muted-foreground">
            Add a permanent customer — its ledger under &quot;Sundry Debtors&quot; is created with
            it.
          </p>
        </div>

        <CustomerForm groups={groups} />
      </div>
    </AppShell>
  );
}
