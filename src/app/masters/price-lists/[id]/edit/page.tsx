import { notFound, redirect } from "next/navigation";

import { AppShell } from "@/components/layout/app-shell";
import { getCurrentCompanyUser } from "@/lib/current-user";
import { hasPermission, isCurrentUserCompanyAdmin } from "@/lib/permissions";
import { PriceListForm } from "@/modules/price-lists/components/price-list-form";
import { PriceListItemsEditor } from "@/modules/price-lists/components/price-list-items-editor";
import { priceListService } from "@/modules/price-lists/services/price-list-service";
import { buildPriceListProductOptions } from "@/modules/price-lists/utils/price-list-product-options";
import { productService } from "@/modules/products/services/product-service";

interface EditPriceListPageProps {
  params: Promise<{ id: string }>;
}

export default async function EditPriceListPage({ params }: EditPriceListPageProps) {
  const { id } = await params;

  const user = await getCurrentCompanyUser();
  const canEdit = await hasPermission(user, "masters", "edit");
  if (!canEdit) {
    redirect("/masters/price-lists");
  }

  const priceList = await priceListService.getPriceList(id);
  if (!priceList) {
    notFound();
  }

  const [isAdmin, activeProducts] = await Promise.all([
    isCurrentUserCompanyAdmin(),
    productService.listSelectableProducts(),
  ]);

  // Merges each item row's product into the picker even if since
  // deactivated, so a stored row's product stays visible and re-selectable
  // (labeled "(Inactive)") — buildProductFormOptions's convention scaled to
  // multiple item rows (29-price-lists.md's UI).
  const productOptions = buildPriceListProductOptions(activeProducts, priceList.items);

  return (
    <AppShell isAdmin={isAdmin}>
      <div className="flex flex-col gap-8 p-6">
        <div>
          <h1 className="text-xl font-semibold text-foreground">
            Edit Price List — {priceList.name}
          </h1>
          <p className="text-sm text-muted-foreground">
            Update the list&apos;s header, then add, edit, or remove item rows below.
          </p>
        </div>

        <PriceListForm priceList={priceList} />

        <div className="flex flex-col gap-3">
          <div>
            <h2 className="text-lg font-semibold text-foreground">Item Rows</h2>
            <p className="text-sm text-muted-foreground">
              Each row fixes a product&apos;s selling price, optionally at a minimum quantity
              break.
            </p>
          </div>
          <PriceListItemsEditor
            priceListId={priceList.id}
            items={priceList.items}
            products={productOptions}
            canEdit={canEdit}
          />
        </div>
      </div>
    </AppShell>
  );
}
