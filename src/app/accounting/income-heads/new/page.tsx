import { redirect } from "next/navigation";

import { AppShell } from "@/components/layout/app-shell";
import { getCurrentCompanyUser } from "@/lib/current-user";
import { hasPermission, isCurrentUserCompanyAdmin } from "@/lib/permissions";
import { createIncomeHeadAction } from "@/modules/ledgers/actions/income-head-actions";
import { LedgerForm } from "@/modules/ledgers/components/ledger-form";
import { ledgerService } from "@/modules/ledgers/services/ledger-service";

export default async function NewIncomeHeadPage() {
  const user = await getCurrentCompanyUser();
  const canCreate = await hasPermission(user, "accounting", "create");
  if (!canCreate) {
    redirect("/accounting/income-heads");
  }

  const [groups, isAdmin] = await Promise.all([
    ledgerService.listSelectableLedgerGroupsForIncomeHead(),
    isCurrentUserCompanyAdmin(),
  ]);

  return (
    <AppShell isAdmin={isAdmin}>
      <div className="flex flex-col gap-6 p-6">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Create Income Head</h1>
          <p className="text-sm text-muted-foreground">
            Add a non-sales income ledger such as interest, rent, or commission received.
          </p>
        </div>

        <LedgerForm
          groups={groups}
          onSubmit={createIncomeHeadAction}
          listPath="/accounting/income-heads"
          entityLabel="Income Head"
          groupHelperText='An income head must belong to "Direct Incomes" or "Indirect Incomes", or one of their sub-groups.'
        />
      </div>
    </AppShell>
  );
}
