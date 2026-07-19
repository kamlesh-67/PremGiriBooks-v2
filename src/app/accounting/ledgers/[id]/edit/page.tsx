import { notFound, redirect } from "next/navigation";

import { AppShell } from "@/components/layout/app-shell";
import { getCurrentCompanyUser } from "@/lib/current-user";
import { hasPermission, isCurrentUserCompanyAdmin } from "@/lib/permissions";
import { ledgerService } from "@/modules/ledgers/services/ledger-service";
import { LedgerEditForm } from "@/modules/ledgers/components/ledger-edit-form";

interface EditLedgerPageProps {
  params: Promise<{ id: string }>;
}

export default async function EditLedgerPage({ params }: EditLedgerPageProps) {
  const { id } = await params;

  const user = await getCurrentCompanyUser();
  const canEdit = await hasPermission(user, "accounting", "edit");
  if (!canEdit) {
    redirect("/accounting/ledgers");
  }

  // getEditableLedger (not getLedger) — a detail-managed ledger (paired with
  // a BankAccount or Customer row) is not editable here; its fields change
  // only through Bank/Customer Management's combined form.
  const ledger = await ledgerService.getEditableLedger(id);
  if (!ledger) {
    notFound();
  }

  const isAdmin = await isCurrentUserCompanyAdmin();

  return (
    <AppShell isAdmin={isAdmin}>
      <div className="flex flex-col gap-6 p-6">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Edit Ledger — {ledger.name}</h1>
          <p className="text-sm text-muted-foreground">
            Update the ledger&apos;s name, opening balance, and description.
          </p>
        </div>

        <LedgerEditForm ledger={ledger} />
      </div>
    </AppShell>
  );
}
