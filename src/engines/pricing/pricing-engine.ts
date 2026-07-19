import type { CustomerType } from "@prisma/client";

import { AppError } from "@/lib/app-error";
import { customerRepository } from "@/modules/customers/repositories/customer-repository";
import { marginProfileRepository } from "@/modules/margin-profiles/repositories/margin-profile-repository";
import { priceListRepository } from "@/modules/price-lists/repositories/price-list-repository";
import { productRepository } from "@/modules/products/repositories/product-repository";
import {
  isPriceListEffective,
  resolveEffectiveTier,
  resolveFromSources,
  type MarginProfileLike,
  type PriceListLike,
} from "@/engines/pricing/price-resolution";
import { resolvePriceInputSchema, type ResolvePriceInput, type ResolvePriceResult } from "@/engines/pricing/types";

// The quantity precision rule is unit-dependent (honors the product's own
// unit.decimalPlaces), so — mirroring product-repository.ts's
// assertMinStockLevelPrecision — it is enforced here, after the product/unit
// row is loaded, rather than as a static Zod bound in types.ts.
function assertQuantityPrecision(quantity: number, decimalPlaces: number): void {
  const factor = 10 ** decimalPlaces;
  if (Math.abs(quantity * factor - Math.round(quantity * factor)) >= 1e-6) {
    throw new AppError(
      decimalPlaces === 0
        ? "Quantity must be a whole number — the selected product's unit has 0 decimal places."
        : `Quantity can have at most ${decimalPlaces} decimal places — the selected product's unit's limit.`
    );
  }
}

/**
 * Active, effective lists for the tier, split into the tier-matching and
 * tier-agnostic buckets `resolveFromSources` consults in order (steps 2/3).
 * One `findEffectiveLists` read already returns both buckets combined
 * (price-list-repository.ts's `customerType` filter includes
 * tier-agnostic lists whenever a tier is given) — partitioned here instead
 * of queried twice.
 */
async function loadTierLists(
  companyId: string,
  tier: CustomerType,
  asOfDate: Date
): Promise<{ tierMatchingLists: PriceListLike[]; tierAgnosticLists: PriceListLike[] }> {
  const lists = await priceListRepository.findEffectiveLists(companyId, {
    customerType: tier,
    effectiveDate: asOfDate,
  });
  return {
    tierMatchingLists: lists.filter((list) => list.customerType === tier),
    tierAgnosticLists: lists.filter((list) => list.customerType === null),
  };
}

/**
 * The customer's directly assigned list (Customer.priceListId), loaded and
 * filtered to active + effective-on-date here — it does not pass through
 * `findEffectiveLists` (that read has no concept of a specific customer's
 * assignment; it only narrows by tier/date across ALL of a company's
 * lists). Returns `null` when unassigned, not found, cross-company,
 * inactive, or not effective on `asOfDate` — any of those cases means this
 * source is skipped, not a hard failure (30-pricing-engine.md's Resolution
 * Order step 1).
 */
async function loadCustomerAssignedList(
  companyId: string,
  priceListId: string | null,
  asOfDate: Date
): Promise<PriceListLike | null> {
  if (!priceListId) {
    return null;
  }
  const list = await priceListRepository.findById(priceListId);
  if (!list || list.companyId !== companyId) {
    return null;
  }
  return isPriceListEffective(list, asOfDate) ? list : null;
}

async function loadActiveMarginProfile(
  companyId: string,
  marginProfileId: string | null
): Promise<MarginProfileLike | null> {
  if (!marginProfileId) {
    return null;
  }
  const profile = await marginProfileRepository.findById(marginProfileId);
  if (!profile || profile.companyId !== companyId || !profile.isActive) {
    return null;
  }
  return profile;
}

export const pricingEngine = {
  /**
   * Resolves the selling price for a product + customer/tier + quantity,
   * per the documented source order (30-pricing-engine.md). No Server
   * Action and no permission check here — the caller (a module service)
   * has already gated permissions and passes its own authorized
   * `companyId`; every loaded row is still re-verified against it
   * (defense in depth, the standing engine convention).
   */
  async resolvePrice(rawInput: ResolvePriceInput): Promise<ResolvePriceResult> {
    const input = resolvePriceInputSchema.parse(rawInput);
    const asOfDate = input.asOfDate ?? new Date();

    const product = await productRepository.findById(input.productId);
    if (!product || product.companyId !== input.companyId) {
      throw new AppError("Product not found.");
    }
    assertQuantityPrecision(input.quantity, product.unit.decimalPlaces);

    // Inactive products are not gated here — document lookups already
    // exclude inactive products, and pricing a stored row must keep working
    // (30-pricing-engine.md's Additional Rules, the unchanged-reference
    // convention mirrored).
    const customer = input.customerId
      ? await customerRepository.findById(input.customerId)
      : null;
    if (input.customerId && (!customer || customer.companyId !== input.companyId)) {
      throw new AppError("Customer not found.");
    }

    const tier = resolveEffectiveTier(customer?.customerType, input.customerType);

    const [customerAssignedList, tierLists, marginProfile] = await Promise.all([
      loadCustomerAssignedList(input.companyId, customer?.priceListId ?? null, asOfDate),
      loadTierLists(input.companyId, tier, asOfDate),
      loadActiveMarginProfile(input.companyId, product.marginProfileId),
    ]);

    return resolveFromSources({
      productId: input.productId,
      quantity: input.quantity,
      tier,
      purchaseCost: product.purchasePrice,
      productSellingPrice: product.sellingPrice,
      customerAssignedList,
      tierMatchingLists: tierLists.tierMatchingLists,
      tierAgnosticLists: tierLists.tierAgnosticLists,
      marginProfile,
    });
  },
};
