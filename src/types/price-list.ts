import type {
  CustomerType,
  PriceList as PrismaPriceList,
  PriceListItem as PrismaPriceListItem,
} from "@prisma/client";

export type { CustomerType };

// PriceList's own columns need no Decimal normalization — only its item rows
// carry Decimal columns (sellingPrice, minQuantity).
export type PriceList = PrismaPriceList;

// `sellingPrice`/`minQuantity` are normalized from Prisma's `Decimal` to
// plain `number`s at the repository layer — a `Decimal` instance does not
// survive the Server Component / Server Action serialization boundary to
// Client Components, so it must never leave the repository (mirrors
// `MarginProfile`'s percent columns in types/margin-profile.ts).
export interface PriceListItem
  extends Omit<PrismaPriceListItem, "sellingPrice" | "minQuantity"> {
  sellingPrice: number;
  minQuantity: number;
}

/** The product identity slice the items editor displays per row — narrow
 * read-model so nothing here changes when the Product module evolves,
 * following ProductMasterOption's convention. `isActive` lets a since-
 * deactivated product's existing row stay visible, labeled "(Inactive)". */
export interface PriceListItemProduct {
  id: string;
  name: string;
  productCode: string;
  isActive: boolean;
}

export interface PriceListItemWithProduct extends PriceListItem {
  product: PriceListItemProduct;
}

/** List-table row shape — an item count instead of the full item rows
 * (29-price-lists.md's UI: "Items count" column). */
export interface PriceListWithItemCount extends PriceList {
  itemCount: number;
}

/** Header + items with product identity — the editor screen's read shape
 * (29-price-lists.md's Service/Repository: getPriceList). */
export interface PriceListDetail extends PriceList {
  items: PriceListItemWithProduct[];
}

export type PriceListStatusFilter = "all" | "active" | "inactive";

export interface PriceListListFilters {
  search?: string;
  status?: PriceListStatusFilter;
}

export type ActivatePriceListResult =
  | { status: "not_found" }
  | { status: "ok"; priceList: PriceList };

export type DeactivatePriceListResult =
  | { status: "not_found" }
  | { status: "ok"; priceList: PriceList };

export type AddPriceListItemResult =
  | { status: "not_found" }
  | { status: "ok"; item: PriceListItemWithProduct };

export type UpdatePriceListItemResult =
  | { status: "not_found" }
  | { status: "ok"; item: PriceListItemWithProduct };

export type RemovePriceListItemResult = { status: "not_found" } | { status: "ok" };

/** findEffectiveLists' filter criteria — the read primitive the Pricing
 * Engine (#28, tracker) will consume (29-price-lists.md's Service/
 * Repository). `effectiveDate` filters to lists whose window (if any) covers
 * that calendar day; omitted = no date filtering. */
export interface EffectivePriceListCriteria {
  customerType?: CustomerType;
  effectiveDate?: Date;
}

/** findEffectiveLists' result shape — header + only the items that belong to
 * it, no product identity (the engine already holds the product it's
 * pricing). */
export interface EffectivePriceList extends PriceList {
  items: PriceListItem[];
}

/** The slice of a Price List the Customer form's picker needs — narrow
 * read-model so nothing here changes when the Price Lists module evolves,
 * following ProductMasterOption's convention. `isActive` lets a customer's
 * since-deactivated assigned list stay visible, labeled "(Inactive)". */
export interface PriceListMasterOption {
  id: string;
  name: string;
  isActive: boolean;
}
