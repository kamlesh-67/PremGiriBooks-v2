import Link from "next/link";
import { redirect } from "next/navigation";
import { Plus } from "lucide-react";

import { AppShell } from "@/components/layout/app-shell";
import { Button } from "@/components/ui/button";
import { getCurrentCompanyUser } from "@/lib/current-user";
import { hasPermission, isCurrentUserCompanyAdmin } from "@/lib/permissions";
import { brandService } from "@/modules/brands/services/brand-service";
import { categoryService } from "@/modules/categories/services/category-service";
import { ProductFilterBar } from "@/modules/products/components/product-filter-bar";
import { ProductTable } from "@/modules/products/components/product-table";
import { productService } from "@/modules/products/services/product-service";
import { PRODUCT_TYPE_VALUES } from "@/modules/products/validation/product-schema";
import type { ProductListFilters, ProductType } from "@/types/product";

interface ProductListPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

function firstValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

// Filter state lives in the URL (see product-filter-bar.tsx); unknown values
// are ignored rather than erroring — a hand-edited query string just falls
// back to the unfiltered list.
function parseFilters(params: Record<string, string | string[] | undefined>): ProductListFilters {
  const filters: ProductListFilters = {};

  const search = firstValue(params.search)?.trim();
  if (search) {
    filters.search = search;
  }

  const type = firstValue(params.type);
  if (type && (PRODUCT_TYPE_VALUES as readonly string[]).includes(type)) {
    filters.productType = type as ProductType;
  }

  const status = firstValue(params.status);
  if (status === "active" || status === "inactive") {
    filters.status = status;
  }

  const categoryId = firstValue(params.category);
  if (categoryId) {
    filters.categoryId = categoryId;
  }

  const brandId = firstValue(params.brand);
  if (brandId) {
    filters.brandId = brandId;
  }

  return filters;
}

export default async function ProductListPage({ searchParams }: ProductListPageProps) {
  const user = await getCurrentCompanyUser();
  const canView = await hasPermission(user, "masters", "view");
  if (!canView) {
    redirect("/");
  }

  const filters = parseFilters(await searchParams);

  const [products, categories, brands, isAdmin, canCreate, canEdit, canManage] = await Promise.all([
    productService.listProducts(filters),
    categoryService.listSelectableCategories(),
    brandService.listSelectableBrands(),
    isCurrentUserCompanyAdmin(),
    hasPermission(user, "masters", "create"),
    hasPermission(user, "masters", "edit"),
    hasPermission(user, "masters", "delete"),
  ]);

  return (
    <AppShell isAdmin={isAdmin}>
      <div className="flex flex-col gap-6 p-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-foreground">Products</h1>
            <p className="text-sm text-muted-foreground">
              Manage the product/item master your sales, purchase, and stock documents will
              reference.
            </p>
          </div>
          {canCreate ? (
            <Button
              nativeButton={false}
              render={
                <Link href="/masters/products/new">
                  <Plus size={18} />
                  New Product
                </Link>
              }
            />
          ) : null}
        </div>

        <ProductFilterBar
          categories={categories.map(({ id, name, isActive }) => ({ id, name, isActive }))}
          brands={brands.map(({ id, name, isActive }) => ({ id, name, isActive }))}
        />

        <ProductTable products={products} canEdit={canEdit} canManage={canManage} />
      </div>
    </AppShell>
  );
}
