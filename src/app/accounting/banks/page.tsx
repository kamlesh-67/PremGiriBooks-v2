import Link from "next/link";
import { redirect } from "next/navigation";
import { Plus } from "lucide-react";

import { AppShell } from "@/components/layout/app-shell";
import { Button } from "@/components/ui/button";
import { getCurrentCompanyUser } from "@/lib/current-user";
import { hasPermission, isCurrentUserCompanyAdmin } from "@/lib/permissions";
import { bankAccountService } from "@/modules/bank-accounts/services/bank-account-service";
import { BankAccountTable } from "@/modules/bank-accounts/components/bank-account-table";

export default async function BankAccountListPage() {
  const user = await getCurrentCompanyUser();
  const canView = await hasPermission(user, "accounting", "view");
  if (!canView) {
    redirect("/");
  }

  const [bankAccounts, isAdmin, canCreate, canEdit, canManage] = await Promise.all([
    bankAccountService.listBankAccounts(),
    isCurrentUserCompanyAdmin(),
    hasPermission(user, "accounting", "create"),
    hasPermission(user, "accounting", "edit"),
    hasPermission(user, "accounting", "delete"),
  ]);

  return (
    <AppShell isAdmin={isAdmin}>
      <div className="flex flex-col gap-6 p-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-foreground">Bank Accounts</h1>
            <p className="text-sm text-muted-foreground">
              Manage your company&apos;s bank accounts.
            </p>
          </div>
          {canCreate ? (
            <Button
              nativeButton={false}
              render={
                <Link href="/accounting/banks/new">
                  <Plus size={18} />
                  New Bank Account
                </Link>
              }
            />
          ) : null}
        </div>

        <BankAccountTable bankAccounts={bankAccounts} canEdit={canEdit} canManage={canManage} />
      </div>
    </AppShell>
  );
}
