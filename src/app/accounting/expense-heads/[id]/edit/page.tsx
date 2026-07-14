import { notFound, redirect } from "next/navigation";

import { AppShell } from "@/components/layout/app-shell";
import { getCurrentCompanyUser } from "@/lib/current-user";
import { hasPermission, isCurrentUserCompanyAdmin } from "@/lib/permissions";
import { updateExpenseHeadAction } from "@/modules/ledgers/actions/expense-head-actions";
import { LedgerEditForm } from "@/modules/ledgers/components/ledger-edit-form";
import { ledgerService } from "@/modules/ledgers/services/ledger-service";

interface EditExpenseHeadPageProps {
  params: Promise<{ id: string }>;
}

export default async function EditExpenseHeadPage({ params }: EditExpenseHeadPageProps) {
  const { id } = await params;

  const user = await getCurrentCompanyUser();
  const canEdit = await hasPermission(user, "accounting", "edit");
  if (!canEdit) {
    redirect("/accounting/expense-heads");
  }

  // getExpenseHead also resolves to not-found for a ledger outside the
  // "Direct Expenses"/"Indirect Expenses" subtrees — a non-expense ledger id
  // pasted into this URL must not open here.
  const expenseHead = await ledgerService.getExpenseHead(id);
  if (!expenseHead) {
    notFound();
  }

  const isAdmin = await isCurrentUserCompanyAdmin();

  return (
    <AppShell isAdmin={isAdmin}>
      <div className="flex flex-col gap-6 p-6">
        <div>
          <h1 className="text-xl font-semibold text-foreground">
            Edit Expense Head — {expenseHead.name}
          </h1>
          <p className="text-sm text-muted-foreground">
            Update the expense head&apos;s name, opening balance, and description.
          </p>
        </div>

        <LedgerEditForm
          ledger={expenseHead}
          action={updateExpenseHeadAction}
          listPath="/accounting/expense-heads"
          entityLabel="Expense Head"
        />
      </div>
    </AppShell>
  );
}
