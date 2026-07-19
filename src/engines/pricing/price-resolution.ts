import type { CustomerType } from "@prisma/client";

import type { PriceSource, ResolvePriceResult } from "@/engines/pricing/types";

// Pure calculation core for the Pricing Engine — no I/O, no Prisma client,
// no session lookups. `pricing-engine.ts` loads every row this module needs
// and delegates every decision to the functions here
// (30-pricing-engine.md's Structure: "engines may import from modules;
// modules never re-implement engine logic").

export interface PriceListItemLike {
  id: string;
  productId: string;
  sellingPrice: number;
  minQuantity: number;
}

export interface PriceListLike {
  id: string;
  customerType: CustomerType | null;
  items: PriceListItemLike[];
}

export interface EffectivePriceListWindow {
  isActive: boolean;
  effectiveFrom: Date | null;
  effectiveTo: Date | null;
}

export interface MarginProfileLike {
  id: string;
  calculationMode: "MARGIN" | "MARKUP";
  retailPercent: number;
  wholesalePercent: number;
  dealerPercent: number;
  distributorPercent: number;
}

export interface ResolveFromSourcesInput {
  productId: string;
  quantity: number;
  tier: CustomerType;
  purchaseCost: number | null;
  productSellingPrice: number | null;
  /** The customer's directly assigned list — already filtered by the caller
   * to active + effective-on-date; `null` when unassigned, inactive, not
   * yet/no-longer effective, or the customer isn't a Permanent Customer. */
  customerAssignedList: PriceListLike | null;
  /** Active, effective, `customerType === tier` lists. */
  tierMatchingLists: PriceListLike[];
  /** Active, effective, `customerType === null` lists. */
  tierAgnosticLists: PriceListLike[];
  /** The product's margin profile — already filtered by the caller to
   * active; `null` when unset or inactive. */
  marginProfile: MarginProfileLike | null;
}

/**
 * Picks the price-list row for `productId` whose `minQuantity` is the
 * highest one `<= quantity` — the quantity-break rule ("1+ -> price A, 10+
 * -> price B" picks the 10+ row once quantity reaches 10). Returns `null`
 * when the product has no row in this list at all, or every row's
 * `minQuantity` exceeds `quantity` (ordering below the lowest break).
 */
export function pickBreakRow(
  items: readonly PriceListItemLike[],
  productId: string,
  quantity: number
): PriceListItemLike | null {
  let best: PriceListItemLike | null = null;
  for (const item of items) {
    if (item.productId !== productId || item.minQuantity > quantity) {
      continue;
    }
    if (!best || item.minQuantity > best.minQuantity) {
      best = item;
    }
  }
  return best;
}

/**
 * Inclusive-boundary, open-ended-window check for a specific price list —
 * the same calendar-day comparison as price-list-repository.ts's
 * `findEffectiveLists`, needed here because the customer's directly
 * assigned list is looked up by id, not through that filtered read.
 */
export function isPriceListEffective(list: EffectivePriceListWindow, asOfDate: Date): boolean {
  if (!list.isActive) {
    return false;
  }
  const day = toUtcMidnight(asOfDate);
  if (list.effectiveFrom && day < toUtcMidnight(list.effectiveFrom)) {
    return false;
  }
  if (list.effectiveTo && day > toUtcMidnight(list.effectiveTo)) {
    return false;
  }
  return true;
}

function toUtcMidnight(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

/**
 * The effective tier: the customer's stored `customerType` when a customer
 * was loaded (`customerId` given), else the caller's explicit
 * `customerType`, else the Walk-in default `RETAIL`.
 */
export function resolveEffectiveTier(
  customerCustomerType: CustomerType | null | undefined,
  explicitCustomerType: CustomerType | undefined
): CustomerType {
  return customerCustomerType ?? explicitCustomerType ?? "RETAIL";
}

function tierPercent(profile: MarginProfileLike, tier: CustomerType): number {
  switch (tier) {
    case "RETAIL":
      return profile.retailPercent;
    case "WHOLESALE":
      return profile.wholesalePercent;
    case "DEALER":
      return profile.dealerPercent;
    case "DISTRIBUTOR":
      return profile.distributorPercent;
  }
}

// Half-up rounding at 2 decimals, applied only to the Margin/Markup formula
// results (30-pricing-engine.md: "No configurable rounding" — price-list and
// product prices are already stored 2-decimal). No shared `src/lib/`
// rounder exists (nor should one — "no price math outside
// src/engines/pricing/" is a grep-able invariant), so this stays local.
function roundHalfUpToTwoDecimals(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

/**
 * Applies a Margin Profile's mode and the effective tier's percent to the
 * latest purchase cost (28-margin-profiles.md's formulas):
 *   MARKUP: price = cost x (1 + percent / 100)
 *   MARGIN: price = cost / (1 - percent / 100)
 * The `< 100` domain for MARGIN mode is enforced at profile creation
 * (28-margin-profiles.md's Zod bound) — not re-checked here.
 */
export function applyProfile(
  profile: MarginProfileLike,
  tier: CustomerType,
  purchaseCost: number
): number {
  const percent = tierPercent(profile, tier);
  const raw =
    profile.calculationMode === "MARKUP"
      ? purchaseCost * (1 + percent / 100)
      : purchaseCost / (1 - percent / 100);
  return roundHalfUpToTwoDecimals(raw);
}

function buildResult(
  price: number | null,
  source: PriceSource,
  purchaseCost: number | null,
  extra: Partial<Pick<ResolvePriceResult, "priceListId" | "priceListItemId" | "marginProfileId">>
): ResolvePriceResult {
  return {
    price,
    source,
    isBelowCost: price !== null && purchaseCost !== null && price < purchaseCost,
    purchaseCost,
    ...extra,
  };
}

/**
 * Picks the lowest-priced matching row across every list in the bucket —
 * "the lowest price wins... so a live promotion is always honored"
 * (30-pricing-engine.md). Ties keep the first list encountered (a
 * deterministic, documented tie-break — the input order is
 * `findEffectiveLists`' `orderBy: { name: "asc" }`, so a tie resolves
 * alphabetically by list name).
 */
function lowestAcrossLists(
  lists: readonly PriceListLike[],
  productId: string,
  quantity: number
): { priceListId: string; item: PriceListItemLike } | null {
  let best: { priceListId: string; item: PriceListItemLike } | null = null;
  for (const list of lists) {
    const item = pickBreakRow(list.items, productId, quantity);
    if (!item) {
      continue;
    }
    if (!best || item.sellingPrice < best.item.sellingPrice) {
      best = { priceListId: list.id, item };
    }
  }
  return best;
}

/**
 * The resolution order itself (30-pricing-engine.md) — first hit wins:
 *   1. Customer's assigned price list (any tier restriction ignored)
 *   2. Tier-matching effective price lists, lowest price
 *   3. Tier-agnostic effective price lists, lowest price
 *   4. Margin Profile applied to the latest purchase cost
 *   5. Product's own `sellingPrice`
 *   6. `null` / `"NONE"`
 * A source with no matching row/value for THIS product/quantity is skipped
 * — it is not enough for a source to merely exist.
 */
export function resolveFromSources(input: ResolveFromSourcesInput): ResolvePriceResult {
  const {
    productId,
    quantity,
    tier,
    purchaseCost,
    productSellingPrice,
    customerAssignedList,
    tierMatchingLists,
    tierAgnosticLists,
    marginProfile,
  } = input;

  if (customerAssignedList) {
    const item = pickBreakRow(customerAssignedList.items, productId, quantity);
    if (item) {
      return buildResult(item.sellingPrice, "CUSTOMER_PRICE_LIST", purchaseCost, {
        priceListId: customerAssignedList.id,
        priceListItemId: item.id,
      });
    }
  }

  const tierMatch = lowestAcrossLists(tierMatchingLists, productId, quantity);
  if (tierMatch) {
    return buildResult(tierMatch.item.sellingPrice, "PRICE_LIST", purchaseCost, {
      priceListId: tierMatch.priceListId,
      priceListItemId: tierMatch.item.id,
    });
  }

  const tierAgnosticMatch = lowestAcrossLists(tierAgnosticLists, productId, quantity);
  if (tierAgnosticMatch) {
    return buildResult(tierAgnosticMatch.item.sellingPrice, "PRICE_LIST", purchaseCost, {
      priceListId: tierAgnosticMatch.priceListId,
      priceListItemId: tierAgnosticMatch.item.id,
    });
  }

  if (marginProfile && purchaseCost !== null) {
    const price = applyProfile(marginProfile, tier, purchaseCost);
    return buildResult(price, "MARGIN_PROFILE", purchaseCost, { marginProfileId: marginProfile.id });
  }

  if (productSellingPrice !== null) {
    return buildResult(productSellingPrice, "PRODUCT_DEFAULT", purchaseCost, {});
  }

  return buildResult(null, "NONE", purchaseCost, {});
}
