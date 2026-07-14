import { notFound, redirect } from "next/navigation";

import { AppShell } from "@/components/layout/app-shell";
import { getCurrentCompanyUser } from "@/lib/current-user";
import { hasPermission, isCurrentUserCompanyAdmin } from "@/lib/permissions";
import { ledgerGroupService } from "@/modules/ledger-groups/services/ledger-group-service";
import { LedgerGroupEditForm } from "@/modules/ledger-groups/components/ledger-group-edit-form";

interface EditLedgerGroupPageProps {
  params: Promise<{ id: string }>;
}

export default async function EditLedgerGroupPage({ params }: EditLedgerGroupPageProps) {
  const { id } = await params;

  const user = await getCurrentCompanyUser();
  const canEdit = await hasPermission(user, "accounting", "edit");
  if (!canEdit) {
    redirect("/accounting/ledger-groups");
  }

  const ledgerGroup = await ledgerGroupService.getLedgerGroup(id);
  if (!ledgerGroup) {
    notFound();
  }

  const parent = ledgerGroup.parentGroupId
    ? await ledgerGroupService.getLedgerGroup(ledgerGroup.parentGroupId)
    : null;
  const isAdmin = await isCurrentUserCompanyAdmin();

  return (
    <AppShell isAdmin={isAdmin}>
      <div className="flex flex-col gap-6 p-6">
        <div>
          <h1 className="text-xl font-semibold text-foreground">
            Edit Ledger Group — {ledgerGroup.name}
          </h1>
          <p className="text-sm text-muted-foreground">
            Update the ledger group&apos;s name and remarks.
          </p>
        </div>

        <LedgerGroupEditForm ledgerGroup={ledgerGroup} parentName={parent?.name ?? null} />
      </div>
    </AppShell>
  );
}
