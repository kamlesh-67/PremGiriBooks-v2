import { notFound, redirect } from "next/navigation";

import { AppShell } from "@/components/layout/app-shell";
import { getCurrentCompanyUser } from "@/lib/current-user";
import { hasPermission, isCurrentUserCompanyAdmin } from "@/lib/permissions";
import { SupplierEditForm } from "@/modules/suppliers/components/supplier-edit-form";
import { supplierService } from "@/modules/suppliers/services/supplier-service";

interface EditSupplierPageProps {
  params: Promise<{ id: string }>;
}

export default async function EditSupplierPage({ params }: EditSupplierPageProps) {
  const { id } = await params;

  const user = await getCurrentCompanyUser();
  const canEdit = await hasPermission(user, "masters", "edit");
  if (!canEdit) {
    redirect("/masters/suppliers");
  }

  const supplier = await supplierService.getSupplier(id);
  if (!supplier) {
    notFound();
  }

  const [isAdmin, activeGroups] = await Promise.all([
    isCurrentUserCompanyAdmin(),
    supplierService.listSelectableLedgerGroupsForSupplier(),
  ]);

  // Merge the supplier's current group into the picker even if since
  // deactivated, so the stored value stays visible — the customer edit
  // page's buildProductFormOptions-style convention, scaled down to one
  // lookup.
  const groups = activeGroups.some((group) => group.id === supplier.ledger.ledgerGroupId)
    ? activeGroups
    : [...activeGroups, supplier.ledger.ledgerGroup];

  return (
    <AppShell isAdmin={isAdmin}>
      <div className="flex flex-col gap-6 p-6">
        <div>
          <h1 className="text-xl font-semibold text-foreground">
            Edit Supplier — {supplier.ledger.name}
          </h1>
          <p className="text-sm text-muted-foreground">
            Update the supplier&apos;s details and its underlying ledger together.
          </p>
        </div>

        <SupplierEditForm supplier={supplier} groups={groups} />
      </div>
    </AppShell>
  );
}
