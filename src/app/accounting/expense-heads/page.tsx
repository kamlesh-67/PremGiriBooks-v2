import Link from "next/link";
import { redirect } from "next/navigation";
import { Plus } from "lucide-react";

import { AppShell } from "@/components/layout/app-shell";
import { Button } from "@/components/ui/button";
import { getCurrentCompanyUser } from "@/lib/current-user";
import { hasPermission, isCurrentUserCompanyAdmin } from "@/lib/permissions";
import {
  activateExpenseHeadAction,
  deactivateExpenseHeadAction,
} from "@/modules/ledgers/actions/expense-head-actions";
import { LedgerTable } from "@/modules/ledgers/components/ledger-table";
import { ledgerService } from "@/modules/ledgers/services/ledger-service";

export default async function ExpenseHeadListPage() {
  const user = await getCurrentCompanyUser();
  const canView = await hasPermission(user, "accounting", "view");
  if (!canView) {
    redirect("/");
  }

  const [expenseHeads, isAdmin, canCreate, canEdit, canManage] = await Promise.all([
    ledgerService.listExpenseHeads(),
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
            <h1 className="text-xl font-semibold text-foreground">Expense Heads</h1>
            <p className="text-sm text-muted-foreground">
              Manage the day-to-day operating expense ledgers under Direct and Indirect
              Expenses.
            </p>
          </div>
          {canCreate ? (
            <Button
              nativeButton={false}
              render={
                <Link href="/accounting/expense-heads/new">
                  <Plus size={18} />
                  New Expense Head
                </Link>
              }
            />
          ) : null}
        </div>

        <LedgerTable
          ledgers={expenseHeads}
          canEdit={canEdit}
          canManage={canManage}
          editBasePath="/accounting/expense-heads"
          entityLabel="Expense Head"
          activateAction={activateExpenseHeadAction}
          deactivateAction={deactivateExpenseHeadAction}
        />
      </div>
    </AppShell>
  );
}
