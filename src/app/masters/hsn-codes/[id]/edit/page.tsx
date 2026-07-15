import { notFound, redirect } from "next/navigation";

import { AppShell } from "@/components/layout/app-shell";
import { getCurrentCompanyUser } from "@/lib/current-user";
import { hasPermission, isCurrentUserCompanyAdmin } from "@/lib/permissions";
import { hsnCodeService } from "@/modules/hsn-codes/services/hsn-code-service";
import { HsnCodeForm } from "@/modules/hsn-codes/components/hsn-code-form";

interface EditHsnCodePageProps {
  params: Promise<{ id: string }>;
}

export default async function EditHsnCodePage({ params }: EditHsnCodePageProps) {
  const { id } = await params;

  const user = await getCurrentCompanyUser();
  const canEdit = await hasPermission(user, "masters", "edit");
  if (!canEdit) {
    redirect("/masters/hsn-codes");
  }

  const hsnCode = await hsnCodeService.getHsnCode(id);
  if (!hsnCode) {
    notFound();
  }

  const isAdmin = await isCurrentUserCompanyAdmin();

  return (
    <AppShell isAdmin={isAdmin}>
      <div className="flex flex-col gap-6 p-6">
        <div>
          <h1 className="text-xl font-semibold text-foreground">
            Edit HSN/SAC Code — {hsnCode.code}
          </h1>
          <p className="text-sm text-muted-foreground">
            Update the code, code type, and description.
          </p>
        </div>

        <HsnCodeForm hsnCode={hsnCode} />
      </div>
    </AppShell>
  );
}
