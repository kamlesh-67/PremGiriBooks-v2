import { redirect } from "next/navigation";

import { AppShell } from "@/components/layout/app-shell";
import { getCurrentCompanyUser } from "@/lib/current-user";
import { hasPermission, isCurrentUserCompanyAdmin } from "@/lib/permissions";
import { bankAccountService } from "@/modules/bank-accounts/services/bank-account-service";
import { BankAccountForm } from "@/modules/bank-accounts/components/bank-account-form";
import { createBankAccountAction } from "@/modules/bank-accounts/actions/bank-account-actions";

export default async function NewBankAccountPage() {
  const user = await getCurrentCompanyUser();
  const canCreate = await hasPermission(user, "accounting", "create");
  if (!canCreate) {
    redirect("/accounting/banks");
  }

  const [groups, isAdmin] = await Promise.all([
    bankAccountService.listSelectableLedgerGroupsForBankAccount(),
    isCurrentUserCompanyAdmin(),
  ]);

  return (
    <AppShell isAdmin={isAdmin}>
      <div className="flex flex-col gap-6 p-6">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Create Bank Account</h1>
          <p className="text-sm text-muted-foreground">
            Add a new company bank account and its underlying ledger.
          </p>
        </div>

        <BankAccountForm groups={groups} onSubmit={createBankAccountAction} />
      </div>
    </AppShell>
  );
}
