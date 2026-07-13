import type { AccountNature, LedgerGroup } from "@prisma/client";

export type { AccountNature, LedgerGroup };

export type LedgerGroupStatusFilter = "all" | "active" | "inactive";

export interface LedgerGroupListFilters {
  search?: string;
  status?: LedgerGroupStatusFilter;
  nature?: AccountNature;
}

export interface LedgerGroupNode extends LedgerGroup {
  children: LedgerGroupNode[];
}

export type DeactivateLedgerGroupResult =
  | { status: "not_found" }
  | { status: "system_defined" }
  | { status: "has_active_children" }
  | { status: "ok"; ledgerGroup: LedgerGroup };

export type ActivateLedgerGroupResult =
  | { status: "not_found" }
  | { status: "parent_inactive" }
  | { status: "ok"; ledgerGroup: LedgerGroup };
