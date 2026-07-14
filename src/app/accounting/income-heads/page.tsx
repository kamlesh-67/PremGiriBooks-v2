import Link from "next/link";
import { redirect } from "next/navigation";
import { Plus } from "lucide-react";

import { AppShell } from "@/components/layout/app-shell";
import { Button } from "@/components/ui/button";
import { getCurrentCompanyUser } from "@/lib/current-user";
import { hasPermission, isCurrentUserCompanyAdmin } from "@/lib/permissions";
import {
  activateIncomeHeadAction,
  deactivateIncomeHeadAction,
} from "@/modules/ledgers/actions/income-head-actions";
import { LedgerTable } from "@/modules/ledgers/components/ledger-table";
import { ledgerService } from "@/modules/ledgers/services/ledger-service";

export default async function IncomeHeadListPage() {
  const user = await getCurrentCompanyUser();
  const canView = await hasPermission(user, "accounting", "view");
  if (!canView) {
    redirect("/");
  }

  const [incomeHeads, isAdmin, canCreate, canEdit, canManage] = await Promise.all([
    ledgerService.listIncomeHeads(),
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
            <h1 className="text-xl font-semibold text-foreground">Income Heads</h1>
            <p className="text-sm text-muted-foreground">
              Manage the non-sales income ledgers under Direct and Indirect Incomes.
            </p>
          </div>
          {canCreate ? (
            <Button
              nativeButton={false}
              render={
                <Link href="/accounting/income-heads/new">
                  <Plus size={18} />
                  New Income Head
                </Link>
              }
            />
          ) : null}
        </div>

        <LedgerTable
          ledgers={incomeHeads}
          canEdit={canEdit}
          canManage={canManage}
          editBasePath="/accounting/income-heads"
          entityLabel="Income Head"
          activateAction={activateIncomeHeadAction}
          deactivateAction={deactivateIncomeHeadAction}
        />
      </div>
    </AppShell>
  );
}
