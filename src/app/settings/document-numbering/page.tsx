import { redirect } from "next/navigation";

import { AppShell } from "@/components/layout/app-shell";
import { getCurrentCompanyUser } from "@/lib/current-user";
import { getCurrentFinancialYear } from "@/lib/current-financial-year";
import { hasPermission, isCurrentUserCompanyAdmin } from "@/lib/permissions";
import { documentSequenceService } from "@/modules/document-sequences/services/document-sequence-service";
import { DocumentSequenceTable } from "@/modules/document-sequences/components/document-sequence-table";

export default async function DocumentNumberingSettingsPage() {
  const user = await getCurrentCompanyUser();
  const canView = await hasPermission(user, "settings", "view");
  if (!canView) {
    redirect("/");
  }

  const financialYear = await getCurrentFinancialYear();

  const [isAdmin, canEdit] = await Promise.all([
    isCurrentUserCompanyAdmin(),
    hasPermission(user, "settings", "edit"),
  ]);

  const sequences = financialYear ? await documentSequenceService.listSequences() : [];

  return (
    <AppShell isAdmin={isAdmin}>
      <div className="flex flex-col gap-6 p-6">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Document Numbering</h1>
          <p className="text-sm text-muted-foreground">
            Configure the prefix and padding each document type uses when numbering, for the
            active financial year.
          </p>
        </div>

        {financialYear ? (
          <DocumentSequenceTable sequences={sequences} canEdit={canEdit} />
        ) : (
          <div className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-border py-16 text-center">
            <p className="text-sm text-muted-foreground">
              Select an active financial year to configure document numbering.
            </p>
          </div>
        )}
      </div>
    </AppShell>
  );
}
