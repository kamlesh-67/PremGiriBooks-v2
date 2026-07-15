import type { HsnCode as PrismaHsnCode, HsnCodeType } from "@prisma/client";

// Like Unit, an HsnCode has no Decimal columns, so the Prisma row is already
// serializable across the Server Component / Server Action boundary as-is.
export type HsnCode = PrismaHsnCode;

export type { HsnCodeType };

export type HsnCodeStatusFilter = "all" | "active" | "inactive";

export interface HsnCodeListFilters {
  search?: string;
  status?: HsnCodeStatusFilter;
  codeType?: HsnCodeType;
}

export type ActivateHsnCodeResult = { status: "not_found" } | { status: "ok"; hsnCode: HsnCode };

export type DeactivateHsnCodeResult = { status: "not_found" } | { status: "ok"; hsnCode: HsnCode };
