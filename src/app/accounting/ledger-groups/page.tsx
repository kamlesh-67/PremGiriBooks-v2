import Link from "next/link";
import { redirect } from "next/navigation";
import { Plus } from "lucide-react";

import { AppShell } from "@/components/layout/app-shell";
import { Button } from "@/components/ui/button";
import { getCurrentUser, isCurrentUserAdmin } from "@/lib/current-user";
import { hasPermission } from "@/lib/permissions";
import { ledgerGroupService } from "@/modules/ledger-groups/services/ledger-group-service";
import { LedgerGroupTree } from "@/modules/ledger-groups/components/ledger-group-tree";

export default async function LedgerGroupListPage() {
  const user = await getCurrentUser();
  const canView = await hasPermission(user, "accounting", "view");
  if (!canView) {
    redirect("/");
  }

  const [tree, isAdmin] = await Promise.all([
    ledgerGroupService.listLedgerGroupTree(),
    isCurrentUserAdmin(),
  ]);

  return (
    <AppShell isAdmin={isAdmin}>
      <div className="flex flex-col gap-6 p-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-foreground">Ledger Groups</h1>
            <p className="text-sm text-muted-foreground">
              Manage the chart-of-accounts group hierarchy for your company.
            </p>
          </div>
          <Button
            nativeButton={false}
            render={
              <Link href="/accounting/ledger-groups/new">
                <Plus size={18} />
                New Ledger Group
              </Link>
            }
          />
        </div>

        <LedgerGroupTree nodes={tree} />
      </div>
    </AppShell>
  );
}
