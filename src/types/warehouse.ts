import type { Warehouse as PrismaWarehouse } from "@prisma/client";

// No Decimal columns on Warehouse — the Prisma row serializes as-is across
// the Server Component / Server Action boundary (unlike GstRate/Ledger).
export type Warehouse = PrismaWarehouse;

/**
 * The slice of Branch the warehouse list and the branch picker need. The
 * Branch module itself is unimplemented (12-branch-management.md, drafted
 * only) — this deliberately stays a narrow read-model instead of a full
 * Branch type so nothing here has to change when that module lands.
 */
export interface WarehouseBranchOption {
  id: string;
  branchName: string;
  isActive: boolean;
}

/** List row shape — the list screen shows the linked branch's name. */
export interface WarehouseWithBranch extends Warehouse {
  branch: WarehouseBranchOption | null;
}

export type WarehouseStatusFilter = "all" | "active" | "inactive";

export interface WarehouseListFilters {
  search?: string;
  status?: WarehouseStatusFilter;
}

export type ActivateWarehouseResult =
  | { status: "not_found" }
  | { status: "ok"; warehouse: Warehouse };

export type DeactivateWarehouseResult =
  | { status: "not_found" }
  | { status: "ok"; warehouse: Warehouse };

export type SetDefaultWarehouseResult =
  | { status: "not_found" }
  | { status: "inactive" }
  | { status: "ok"; warehouse: Warehouse };

export type UnsetDefaultWarehouseResult =
  | { status: "not_found" }
  | { status: "ok"; warehouse: Warehouse };
