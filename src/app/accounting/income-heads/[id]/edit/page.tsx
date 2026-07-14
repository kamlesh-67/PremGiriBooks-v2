import { notFound, redirect } from "next/navigation";

import { AppShell } from "@/components/layout/app-shell";
import { getCurrentCompanyUser } from "@/lib/current-user";
import { hasPermission, isCurrentUserCompanyAdmin } from "@/lib/permissions";
import { updateIncomeHeadAction } from "@/modules/ledgers/actions/income-head-actions";
import { LedgerEditForm } from "@/modules/ledgers/components/ledger-edit-form";
import { ledgerService } from "@/modules/ledgers/services/ledger-service";

interface EditIncomeHeadPageProps {
  params: Promise<{ id: string }>;
}

export default async function EditIncomeHeadPage({ params }: EditIncomeHeadPageProps) {
  const { id } = await params;

  const user = await getCurrentCompanyUser();
  const canEdit = await hasPermission(user, "accounting", "edit");
  if (!canEdit) {
    redirect("/accounting/income-heads");
  }

  // getIncomeHead also resolves to not-found for a ledger outside the
  // "Direct Incomes"/"Indirect Incomes" subtrees — a non-income ledger id
  // pasted into this URL must not open here.
  const incomeHead = await ledgerService.getIncomeHead(id);
  if (!incomeHead) {
    notFound();
  }

  const isAdmin = await isCurrentUserCompanyAdmin();

  return (
    <AppShell isAdmin={isAdmin}>
      <div className="flex flex-col gap-6 p-6">
        <div>
          <h1 className="text-xl font-semibold text-foreground">
            Edit Income Head — {incomeHead.name}
          </h1>
          <p className="text-sm text-muted-foreground">
            Update the income head&apos;s name, opening balance, and description.
          </p>
        </div>

        <LedgerEditForm
          ledger={incomeHead}
          action={updateIncomeHeadAction}
          listPath="/accounting/income-heads"
          entityLabel="Income Head"
        />
      </div>
    </AppShell>
  );
}
