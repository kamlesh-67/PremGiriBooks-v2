import type { Unit as PrismaUnit } from "@prisma/client";

// Unlike Ledger, a Unit has no Decimal columns, so the Prisma row is already
// serializable across the Server Component / Server Action boundary as-is.
export type Unit = PrismaUnit;

export type UnitStatusFilter = "all" | "active" | "inactive";

export interface UnitListFilters {
  search?: string;
  status?: UnitStatusFilter;
}

export type ActivateUnitResult = { status: "not_found" } | { status: "ok"; unit: Unit };

export type DeactivateUnitResult = { status: "not_found" } | { status: "ok"; unit: Unit };
