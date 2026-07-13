import { redirect } from "next/navigation";

import { AppShell } from "@/components/layout/app-shell";
import { getCurrentUser, isCurrentUserAdmin } from "@/lib/current-user";
import { hasPermission } from "@/lib/permissions";
import { ledgerGroupService } from "@/modules/ledger-groups/services/ledger-group-service";
import { LedgerGroupForm } from "@/modules/ledger-groups/components/ledger-group-form";
import { createLedgerGroupAction } from "@/modules/ledger-groups/actions/ledger-group-actions";

export default async function NewLedgerGroupPage() {
  const user = await getCurrentUser();
  const canCreate = await hasPermission(user, "accounting", "create");
  if (!canCreate) {
    redirect("/accounting/ledger-groups");
  }

  const [groups, isAdmin] = await Promise.all([
    ledgerGroupService.listSelectableLedgerGroups(),
    isCurrentUserAdmin(),
  ]);

  return (
    <AppShell isAdmin={isAdmin}>
      <div className="flex flex-col gap-6 p-6">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Create Ledger Group</h1>
          <p className="text-sm text-muted-foreground">
            Add a new ledger group to your chart of accounts.
          </p>
        </div>

        <LedgerGroupForm groups={groups} onSubmit={createLedgerGroupAction} />
      </div>
    </AppShell>
  );
}
