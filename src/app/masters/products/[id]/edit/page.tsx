import { notFound, redirect } from "next/navigation";

import { AppShell } from "@/components/layout/app-shell";
import { getCurrentCompanyUser } from "@/lib/current-user";
import { hasPermission, isCurrentUserCompanyAdmin } from "@/lib/permissions";
import { brandService } from "@/modules/brands/services/brand-service";
import { categoryService } from "@/modules/categories/services/category-service";
import { gstRateService } from "@/modules/gst-rates/services/gst-rate-service";
import { hsnCodeService } from "@/modules/hsn-codes/services/hsn-code-service";
import { marginProfileService } from "@/modules/margin-profiles/services/margin-profile-service";
import { ProductEditForm } from "@/modules/products/components/product-edit-form";
import { buildProductFormOptions } from "@/modules/products/utils/product-form-options";
import { productService } from "@/modules/products/services/product-service";
import { unitService } from "@/modules/units/services/unit-service";
import { warehouseService } from "@/modules/warehouses/services/warehouse-service";

interface EditProductPageProps {
  params: Promise<{ id: string }>;
}

export default async function EditProductPage({ params }: EditProductPageProps) {
  const { id } = await params;

  const user = await getCurrentCompanyUser();
  const canEdit = await hasPermission(user, "masters", "edit");
  if (!canEdit) {
    redirect("/masters/products");
  }

  const product = await productService.getProduct(id);
  if (!product) {
    notFound();
  }

  const [isAdmin, categories, brands, units, hsnCodes, gstRates, warehouses, marginProfiles] =
    await Promise.all([
      isCurrentUserCompanyAdmin(),
      categoryService.listSelectableCategories(),
      brandService.listSelectableBrands(),
      unitService.listSelectableUnits(),
      hsnCodeService.listSelectableHsnCodes(),
      gstRateService.listSelectableGstRates(),
      warehouseService.listSelectableWarehouses(),
      marginProfileService.listSelectableMarginProfiles(),
    ]);

  // Merges the product's current references into the pickers even if since
  // deactivated, so each stored value stays visible and re-selectable
  // (labeled "(Inactive)") — the warehouse edit page's includeBranchId
  // convention, scaled to seven lookups.
  const options = buildProductFormOptions(
    { categories, brands, units, hsnCodes, gstRates, warehouses, marginProfiles },
    product
  );

  return (
    <AppShell isAdmin={isAdmin}>
      <div className="flex flex-col gap-6 p-6">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Edit Product — {product.name}</h1>
          <p className="text-sm text-muted-foreground">
            Update the product&apos;s identity, classification, tax links, reference prices, and
            stock settings.
          </p>
        </div>

        <ProductEditForm product={product} options={options} />
      </div>
    </AppShell>
  );
}
