import type { GstRate as PrismaGstRate } from "@prisma/client";

// `ratePercent`/`cessPercent` are normalized from Prisma's `Decimal` to plain
// `number`s at the repository layer — a `Decimal` instance does not survive
// the Server Component / Server Action serialization boundary to Client
// Components, so it must never leave the repository (mirrors
// `Ledger.openingBalance` in types/ledger.ts).
export interface GstRate extends Omit<PrismaGstRate, "ratePercent" | "cessPercent"> {
  ratePercent: number;
  cessPercent: number;
}

export type GstRateStatusFilter = "all" | "active" | "inactive";

export interface GstRateListFilters {
  search?: string;
  status?: GstRateStatusFilter;
}

export type ActivateGstRateResult = { status: "not_found" } | { status: "ok"; gstRate: GstRate };

export type DeactivateGstRateResult = { status: "not_found" } | { status: "ok"; gstRate: GstRate };
