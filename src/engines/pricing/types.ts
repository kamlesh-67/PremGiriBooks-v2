import { z } from "zod";

import { CUSTOMER_TYPE_VALUES } from "@/modules/customers/validation/customer-schema";

// Engines are system boundaries for their consumers even though they are
// not HTTP boundaries (30-pricing-engine.md's Validation) — `companyId` is
// the authorized caller's tenant scope, never trusted from client input;
// every loaded row is still re-verified against it inside pricing-engine.ts
// (defense in depth, the standing engine convention).
export const resolvePriceInputSchema = z.object({
  companyId: z.uuid("A valid company is required"),
  productId: z.uuid("Select a valid product"),
  // The tighter "no more decimals than the product's unit allows" rule is
  // unit-dependent, so — mirroring product-repository.ts's
  // assertMinStockLevelPrecision — it is enforced in pricing-engine.ts after
  // the product/unit row is loaded, not here.
  quantity: z.number("Quantity must be a number").positive("Quantity must be greater than zero"),
  customerId: z.uuid("Select a valid customer").optional(),
  customerType: z.enum(CUSTOMER_TYPE_VALUES, "Select a valid customer type").optional(),
  asOfDate: z.date().optional(),
});

export type ResolvePriceInput = z.infer<typeof resolvePriceInputSchema>;

export type PriceSource =
  | "CUSTOMER_PRICE_LIST"
  | "PRICE_LIST"
  | "MARGIN_PROFILE"
  | "PRODUCT_DEFAULT"
  | "NONE";

export interface ResolvePriceResult {
  price: number | null;
  source: PriceSource;
  priceListId?: string;
  priceListItemId?: string;
  marginProfileId?: string;
  isBelowCost: boolean;
  purchaseCost: number | null;
}
