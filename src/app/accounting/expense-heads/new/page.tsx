import { redirect } from "next/navigation";

import { AppShell } from "@/components/layout/app-shell";
import { getCurrentCompanyUser } from "@/lib/current-user";
import { hasPermission, isCurrentUserCompanyAdmin } from "@/lib/permissions";
import { createExpenseHeadAction } from "@/modules/ledgers/actions/expense-head-actions";
import { LedgerForm } from "@/modules/ledgers/components/ledger-form";
import { ledgerService } from "@/modules/ledgers/services/ledger-service";

export default async function NewExpenseHeadPage() {
  const user = await getCurrentCompanyUser();
  const canCreate = await hasPermission(user, "accounting", "create");
  if (!canCreate) {
    redirect("/accounting/expense-heads");
  }

  const [groups, isAdmin] = await Promise.all([
    ledgerService.listSelectableLedgerGroupsForExpenseHead(),
    isCurrentUserCompanyAdmin(),
  ]);

  return (
    <AppShell isAdmin={isAdmin}>
      <div className="flex flex-col gap-6 p-6">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Create Expense Head</h1>
          <p className="text-sm text-muted-foreground">
            Add an operating expense ledger such as rent, salaries, or electricity.
          </p>
        </div>

        <LedgerForm
          groups={groups}
          onSubmit={createExpenseHeadAction}
          listPath="/accounting/expense-heads"
          entityLabel="Expense Head"
          groupHelperText='An expense head must belong to "Direct Expenses" or "Indirect Expenses", or one of their sub-groups.'
        />
      </div>
    </AppShell>
  );
}
