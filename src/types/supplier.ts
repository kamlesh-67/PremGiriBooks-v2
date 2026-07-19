import type { Supplier as PrismaSupplier } from "@prisma/client";

import type { LedgerWithGroup } from "@/types/ledger";

export type Supplier = PrismaSupplier;

/** Row shape for the list table and the edit form — the display name,
 * opening balance/type, description, and group live on the paired Ledger
 * (27-supplier-management.md's 1:1 extension model, mirroring Customer's). */
export interface SupplierWithLedger extends Supplier {
  ledger: LedgerWithGroup;
}

export type SupplierStatusFilter = "all" | "active" | "inactive";

export interface SupplierListFilters {
  search?: string;
  status?: SupplierStatusFilter;
}

export type ActivateSupplierResult =
  | { status: "not_found" }
  | { status: "ok"; supplier: SupplierWithLedger };

export type DeactivateSupplierResult =
  | { status: "not_found" }
  | { status: "ok"; supplier: SupplierWithLedger };
