import type { Brand } from "@/types/brand";
import type { Category } from "@/types/category";
import type { GstRate } from "@/types/gst-rate";
import type { HsnCode } from "@/types/hsn-code";
import type { MarginProfile } from "@/types/margin-profile";
import type {
  ProductHsnOption,
  ProductMasterOption,
  ProductUnitOption,
  ProductWithRelations,
} from "@/types/product";
import type { Unit } from "@/types/unit";
import type { WarehouseWithBranch } from "@/types/warehouse";

/** The seven pickers' options, assembled server-side by the new/edit pages. */
export interface ProductFormOptions {
  categories: ProductMasterOption[];
  brands: ProductMasterOption[];
  units: ProductUnitOption[];
  hsnCodes: ProductHsnOption[];
  gstRates: ProductMasterOption[];
  warehouses: ProductMasterOption[];
  marginProfiles: ProductMasterOption[];
}

// The sibling modules' listSelectable…() lookups return active masters only.
// On edit, the product's current reference may have been deactivated since
// assignment — it is merged in anyway so the stored value stays visible and
// re-selectable (labeled "(Inactive)" by the picker), mirroring the
// warehouse branch picker's includeBranchId convention.
function withCurrent<T extends { id: string }>(options: T[], current: T | null | undefined): T[] {
  if (!current || options.some((option) => option.id === current.id)) {
    return options;
  }
  return [current, ...options];
}

function toMasterOption(row: { id: string; name: string; isActive: boolean }): ProductMasterOption {
  return { id: row.id, name: row.name, isActive: row.isActive };
}

export interface ProductFormOptionSources {
  categories: Category[];
  brands: Brand[];
  units: Unit[];
  hsnCodes: HsnCode[];
  gstRates: GstRate[];
  warehouses: WarehouseWithBranch[];
  marginProfiles: MarginProfile[];
}

export function buildProductFormOptions(
  sources: ProductFormOptionSources,
  product?: ProductWithRelations
): ProductFormOptions {
  return {
    categories: withCurrent(sources.categories.map(toMasterOption), product?.category),
    brands: withCurrent(sources.brands.map(toMasterOption), product?.brand),
    units: withCurrent(
      sources.units.map((unit) => ({
        id: unit.id,
        name: unit.name,
        symbol: unit.symbol,
        decimalPlaces: unit.decimalPlaces,
        isActive: unit.isActive,
      })),
      product?.unit
    ),
    hsnCodes: withCurrent(
      sources.hsnCodes.map((hsnCode) => ({
        id: hsnCode.id,
        code: hsnCode.code,
        codeType: hsnCode.codeType,
        description: hsnCode.description,
        isActive: hsnCode.isActive,
      })),
      product?.hsnCode
    ),
    gstRates: withCurrent(sources.gstRates.map(toMasterOption), product?.gstRate),
    warehouses: withCurrent(sources.warehouses.map(toMasterOption), product?.defaultWarehouse),
    marginProfiles: withCurrent(sources.marginProfiles.map(toMasterOption), product?.marginProfile),
  };
}
