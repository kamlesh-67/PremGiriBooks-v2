import type { Customer as PrismaCustomer, CustomerType } from "@prisma/client";

import type { LedgerWithGroup } from "@/types/ledger";
import type { PriceListMasterOption } from "@/types/price-list";

export type { CustomerType };

// `creditLimit` is normalized from Prisma's `Decimal` to a plain `number`
// at the repository layer — a `Decimal` instance does not survive the
// Server Component / Server Action serialization boundary to Client
// Components, so it must never leave the repository (the
// `Ledger.openingBalance`/GstRate convention).
export interface Customer extends Omit<PrismaCustomer, "creditLimit"> {
  creditLimit: number | null;
}

/** Row shape for the list table and the edit form — the display name,
 * opening balance/type, description, and group live on the paired Ledger
 * (26-customer-management.md's 1:1 extension model). `priceList` is the
 * assigned Price List's identity (null when unassigned), read alongside the
 * customer so the edit form can keep a since-deactivated assignment visible
 * (30-pricing-engine.md). */
export interface CustomerWithLedger extends Customer {
  ledger: LedgerWithGroup;
  priceList: PriceListMasterOption | null;
}

export type CustomerStatusFilter = "all" | "active" | "inactive";

export interface CustomerListFilters {
  search?: string;
  status?: CustomerStatusFilter;
  customerType?: CustomerType;
}

export type ActivateCustomerResult =
  | { status: "not_found" }
  | { status: "ok"; customer: CustomerWithLedger };

export type DeactivateCustomerResult =
  | { status: "not_found" }
  | { status: "ok"; customer: CustomerWithLedger };
