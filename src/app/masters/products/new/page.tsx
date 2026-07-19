import { redirect } from "next/navigation";

import { AppShell } from "@/components/layout/app-shell";
import { getCurrentCompanyUser } from "@/lib/current-user";
import { hasPermission, isCurrentUserCompanyAdmin } from "@/lib/permissions";
import { brandService } from "@/modules/brands/services/brand-service";
import { categoryService } from "@/modules/categories/services/category-service";
import { gstRateService } from "@/modules/gst-rates/services/gst-rate-service";
import { hsnCodeService } from "@/modules/hsn-codes/services/hsn-code-service";
import { marginProfileService } from "@/modules/margin-profiles/services/margin-profile-service";
import { ProductForm } from "@/modules/products/components/product-form";
import { buildProductFormOptions } from "@/modules/products/utils/product-form-options";
import { unitService } from "@/modules/units/services/unit-service";
import { warehouseService } from "@/modules/warehouses/services/warehouse-service";

export default async function NewProductPage() {
  const user = await getCurrentCompanyUser();
  const canCreate = await hasPermission(user, "masters", "create");
  if (!canCreate) {
    redirect("/masters/products");
  }

  // The seven sibling masters' active-only lookups (each built for this
  // form, per specs 19–24 and 28). HSN codes come unfiltered — the form
  // itself narrows to HSN-vs-SAC based on the chosen product type.
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

  const options = buildProductFormOptions({
    categories,
    brands,
    units,
    hsnCodes,
    gstRates,
    warehouses,
    marginProfiles,
  });

  return (
    <AppShell isAdmin={isAdmin}>
      <div className="flex flex-col gap-6 p-6">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Create Product</h1>
          <p className="text-sm text-muted-foreground">
            Add a trading product, service, or expense item to the product master.
          </p>
        </div>

        <ProductForm options={options} />
      </div>
    </AppShell>
  );
}
