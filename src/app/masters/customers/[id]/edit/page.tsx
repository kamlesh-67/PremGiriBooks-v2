import { notFound, redirect } from "next/navigation";

import { AppShell } from "@/components/layout/app-shell";
import { getCurrentCompanyUser } from "@/lib/current-user";
import { hasPermission, isCurrentUserCompanyAdmin } from "@/lib/permissions";
import { CustomerEditForm } from "@/modules/customers/components/customer-edit-form";
import { customerService } from "@/modules/customers/services/customer-service";
import { priceListService } from "@/modules/price-lists/services/price-list-service";
import type { PriceListMasterOption } from "@/types/price-list";

interface EditCustomerPageProps {
  params: Promise<{ id: string }>;
}

export default async function EditCustomerPage({ params }: EditCustomerPageProps) {
  const { id } = await params;

  const user = await getCurrentCompanyUser();
  const canEdit = await hasPermission(user, "masters", "edit");
  if (!canEdit) {
    redirect("/masters/customers");
  }

  const customer = await customerService.getCustomer(id);
  if (!customer) {
    notFound();
  }

  const [isAdmin, activeGroups, activePriceLists] = await Promise.all([
    isCurrentUserCompanyAdmin(),
    customerService.listSelectableLedgerGroupsForCustomer(),
    priceListService.listSelectablePriceLists(),
  ]);

  // Merge the customer's current group into the picker even if since
  // deactivated, so the stored value stays visible — the product edit page's
  // buildProductFormOptions convention, scaled down to one lookup.
  const groups = activeGroups.some((group) => group.id === customer.ledger.ledgerGroupId)
    ? activeGroups
    : [...activeGroups, customer.ledger.ledgerGroup];

  // Same merge for the assigned Price List — a since-deactivated assignment
  // stays visible and re-selectable on the edit form (30-pricing-engine.md).
  const currentPriceList = customer.priceList;
  const priceLists: PriceListMasterOption[] =
    currentPriceList && !activePriceLists.some((list) => list.id === currentPriceList.id)
      ? [...activePriceLists, currentPriceList]
      : activePriceLists;

  return (
    <AppShell isAdmin={isAdmin}>
      <div className="flex flex-col gap-6 p-6">
        <div>
          <h1 className="text-xl font-semibold text-foreground">
            Edit Customer — {customer.ledger.name}
          </h1>
          <p className="text-sm text-muted-foreground">
            Update the customer&apos;s details and its underlying ledger together.
          </p>
        </div>

        <CustomerEditForm customer={customer} groups={groups} priceLists={priceLists} />
      </div>
    </AppShell>
  );
}
