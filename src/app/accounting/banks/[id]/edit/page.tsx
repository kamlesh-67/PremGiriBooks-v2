import { notFound, redirect } from "next/navigation";

import { AppShell } from "@/components/layout/app-shell";
import { getCurrentCompanyUser } from "@/lib/current-user";
import { hasPermission, isCurrentUserCompanyAdmin } from "@/lib/permissions";
import { bankAccountService } from "@/modules/bank-accounts/services/bank-account-service";
import { BankAccountEditForm } from "@/modules/bank-accounts/components/bank-account-edit-form";

interface EditBankAccountPageProps {
  params: Promise<{ id: string }>;
}

export default async function EditBankAccountPage({ params }: EditBankAccountPageProps) {
  const { id } = await params;

  const user = await getCurrentCompanyUser();
  const canEdit = await hasPermission(user, "accounting", "edit");
  if (!canEdit) {
    redirect("/accounting/banks");
  }

  const bankAccount = await bankAccountService.getBankAccount(id);
  if (!bankAccount) {
    notFound();
  }

  const isAdmin = await isCurrentUserCompanyAdmin();

  return (
    <AppShell isAdmin={isAdmin}>
      <div className="flex flex-col gap-6 p-6">
        <div>
          <h1 className="text-xl font-semibold text-foreground">
            Edit Bank Account — {bankAccount.ledger.name}
          </h1>
          <p className="text-sm text-muted-foreground">
            Update the bank account&apos;s details and its underlying ledger.
          </p>
        </div>

        <BankAccountEditForm bankAccount={bankAccount} />
      </div>
    </AppShell>
  );
}
