import type { Brand as PrismaBrand } from "@prisma/client";

// Like Unit, a Brand has no Decimal columns, so the Prisma row is already
// serializable across the Server Component / Server Action boundary as-is.
export type Brand = PrismaBrand;

export type BrandStatusFilter = "all" | "active" | "inactive";

export interface BrandListFilters {
  search?: string;
  status?: BrandStatusFilter;
}

export type ActivateBrandResult = { status: "not_found" } | { status: "ok"; brand: Brand };

export type DeactivateBrandResult = { status: "not_found" } | { status: "ok"; brand: Brand };
