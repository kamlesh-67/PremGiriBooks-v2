import type { MarginProfile as PrismaMarginProfile, PriceCalculationMode } from "@prisma/client";

// The four Decimal(5,2) percent columns are normalized from Prisma's
// `Decimal` to plain `number`s at the repository layer — a `Decimal`
// instance does not survive the Server Component / Server Action
// serialization boundary to Client Components, so it must never leave the
// repository (mirrors `GstRate.ratePercent` in types/gst-rate.ts).
export interface MarginProfile
  extends Omit<
    PrismaMarginProfile,
    "retailPercent" | "wholesalePercent" | "dealerPercent" | "distributorPercent"
  > {
  retailPercent: number;
  wholesalePercent: number;
  dealerPercent: number;
  distributorPercent: number;
}

export type { PriceCalculationMode };

export type MarginProfileStatusFilter = "all" | "active" | "inactive";

export interface MarginProfileListFilters {
  search?: string;
  status?: MarginProfileStatusFilter;
}

export type ActivateMarginProfileResult =
  | { status: "not_found" }
  | { status: "ok"; marginProfile: MarginProfile };

export type DeactivateMarginProfileResult =
  | { status: "not_found" }
  | { status: "ok"; marginProfile: MarginProfile };
