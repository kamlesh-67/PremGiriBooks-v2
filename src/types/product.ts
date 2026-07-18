import type { Product as PrismaProduct, ProductType } from "@prisma/client";

// `mrp`/`sellingPrice`/`purchasePrice`/`minStockLevel` are normalized from
// Prisma's `Decimal` to plain `number`s at the repository layer — a `Decimal`
// instance does not survive the Server Component / Server Action
// serialization boundary to Client Components, so it must never leave the
// repository (mirrors `GstRate.ratePercent` in types/gst-rate.ts).
export interface Product
  extends Omit<PrismaProduct, "mrp" | "sellingPrice" | "purchasePrice" | "minStockLevel"> {
  mrp: number | null;
  sellingPrice: number | null;
  purchasePrice: number | null;
  minStockLevel: number | null;
}

export type { ProductType };

/**
 * The slice of a referenced master (Category, Brand, GST Rate, Warehouse)
 * the product list and the form pickers need — deliberately a narrow
 * read-model so nothing here changes when those modules evolve, following
 * WarehouseBranchOption's convention. `isActive` is carried so an edited
 * product's since-deactivated reference can stay visible in its picker,
 * labeled "(Inactive)".
 */
export interface ProductMasterOption {
  id: string;
  name: string;
  isActive: boolean;
}

/** Unit picker option — symbol for display, decimalPlaces because
 * minStockLevel honors the selected unit's decimal places. */
export interface ProductUnitOption {
  id: string;
  name: string;
  symbol: string;
  decimalPlaces: number;
  isActive: boolean;
}

/** HSN/SAC picker option — codeType drives the goods-vs-services filter. */
export interface ProductHsnOption {
  id: string;
  code: string;
  codeType: "HSN" | "SAC";
  description: string;
  isActive: boolean;
}

/** Row shape for the list table and detail/edit views — related master
 * names are read in the same query (25-product-management.md's
 * listProducts/getProduct). */
export interface ProductWithRelations extends Product {
  category: ProductMasterOption | null;
  brand: ProductMasterOption | null;
  unit: ProductUnitOption;
  hsnCode: ProductHsnOption | null;
  gstRate: ProductMasterOption | null;
  defaultWarehouse: ProductMasterOption | null;
}

export type ProductStatusFilter = "all" | "active" | "inactive";

export interface ProductListFilters {
  search?: string;
  status?: ProductStatusFilter;
  productType?: ProductType;
  categoryId?: string;
  brandId?: string;
}

export type ActivateProductResult =
  | { status: "not_found" }
  | { status: "ok"; product: ProductWithRelations };

export type DeactivateProductResult =
  | { status: "not_found" }
  | { status: "ok"; product: ProductWithRelations };
