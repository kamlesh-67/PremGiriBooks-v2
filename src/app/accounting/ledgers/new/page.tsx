import { redirect } from "next/navigation";

import { AppShell } from "@/components/layout/app-shell";
import { getCurrentCompanyUser } from "@/lib/current-user";
import { hasPermission, isCurrentUserCompanyAdmin } from "@/lib/permissions";
import { ledgerService } from "@/modules/ledgers/services/ledger-service";
import { LedgerForm } from "@/modules/ledgers/components/ledger-form";
import { createLedgerAction } from "@/modules/ledgers/actions/ledger-actions";

export default async function NewLedgerPage() {
  const user = await getCurrentCompanyUser();
  const canCreate = await hasPermission(user, "accounting", "create");
  if (!canCreate) {
    redirect("/accounting/ledgers");
  }

  const [groups, isAdmin] = await Promise.all([
    ledgerService.listSelectableLedgerGroupsForLedger(),
    isCurrentUserCompanyAdmin(),
  ]);

  return (
    <AppShell isAdmin={isAdmin}>
      <div className="flex flex-col gap-6 p-6">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Create Ledger</h1>
          <p className="text-sm text-muted-foreground">
            Add a new ledger to your chart of accounts.
          </p>
        </div>

        <LedgerForm groups={groups} onSubmit={createLedgerAction} />
      </div>
    </AppShell>
  );
}
