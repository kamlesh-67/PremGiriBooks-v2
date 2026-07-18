"use client";

import * as React from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Pencil } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  activateWarehouseAction,
  deactivateWarehouseAction,
  setDefaultWarehouseAction,
  unsetDefaultWarehouseAction,
} from "@/modules/warehouses/actions/warehouse-actions";
import { WarehouseDefaultBadge } from "@/modules/warehouses/components/warehouse-default-badge";
import { WarehouseStatusBadge } from "@/modules/warehouses/components/warehouse-status-badge";
import type { WarehouseWithBranch } from "@/types/warehouse";

interface WarehouseTableProps {
  warehouses: WarehouseWithBranch[];
  canEdit?: boolean;
  canManage?: boolean;
}

export function WarehouseTable({
  warehouses,
  canEdit = false,
  canManage = false,
}: WarehouseTableProps) {
  // Tracked per row (not a single pending id) so two rows toggled
  // concurrently each keep their own disabled state — the
  // hsn-code-table.tsx review-fix pattern (2026-07-15).
  const [pendingIds, setPendingIds] = React.useState<ReadonlySet<string>>(new Set());

  function markPending(id: string) {
    setPendingIds((prev) => new Set(prev).add(id));
  }

  function clearPending(id: string) {
    setPendingIds((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  }

  async function handleToggleActive(warehouse: WarehouseWithBranch) {
    markPending(warehouse.id);
    const action = warehouse.isActive ? deactivateWarehouseAction : activateWarehouseAction;

    try {
      const result = await action(warehouse.id);
      if (!result.success) {
        toast.error(result.error ?? "Failed to update warehouse status.");
        return;
      }
      toast.success(warehouse.isActive ? "Warehouse deactivated." : "Warehouse activated.");
    } catch {
      toast.error("Failed to update warehouse status.");
    } finally {
      clearPending(warehouse.id);
    }
  }

  async function handleToggleDefault(warehouse: WarehouseWithBranch) {
    markPending(warehouse.id);
    const action = warehouse.isDefault ? unsetDefaultWarehouseAction : setDefaultWarehouseAction;

    try {
      const result = await action(warehouse.id);
      if (!result.success) {
        toast.error(result.error ?? "Failed to update the default warehouse.");
        return;
      }
      toast.success(
        warehouse.isDefault ? "Default warehouse unset." : "Default warehouse updated."
      );
    } catch {
      toast.error("Failed to update the default warehouse.");
    } finally {
      clearPending(warehouse.id);
    }
  }

  if (warehouses.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-border py-16 text-center">
        <p className="text-sm text-muted-foreground">No warehouses found.</p>
      </div>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Name</TableHead>
          <TableHead>Code</TableHead>
          <TableHead>Branch</TableHead>
          <TableHead>Default</TableHead>
          <TableHead>Status</TableHead>
          <TableHead className="text-right">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {warehouses.map((warehouse) => (
          <TableRow key={warehouse.id}>
            <TableCell>
              <span className="font-medium text-foreground">{warehouse.name}</span>
            </TableCell>
            <TableCell>{warehouse.code}</TableCell>
            <TableCell>
              {warehouse.branch ? (
                warehouse.branch.branchName
              ) : (
                <span className="text-muted-foreground">—</span>
              )}
            </TableCell>
            <TableCell>{warehouse.isDefault ? <WarehouseDefaultBadge /> : null}</TableCell>
            <TableCell>
              <WarehouseStatusBadge isActive={warehouse.isActive} />
            </TableCell>
            <TableCell className="text-right">
              <div className="flex justify-end gap-2">
                {canEdit ? (
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    nativeButton={false}
                    render={
                      <Link
                        href={`/masters/warehouses/${warehouse.id}/edit`}
                        aria-label="Edit warehouse"
                      >
                        <Pencil size={16} />
                      </Link>
                    }
                  />
                ) : null}
                {canEdit ? (
                  <Button
                    variant="outline"
                    size="sm"
                    // Only an active warehouse can be made default
                    // (24-warehouse-management.md) — the server enforces it;
                    // this just avoids offering a doomed action.
                    disabled={pendingIds.has(warehouse.id) || !warehouse.isActive}
                    onClick={() => handleToggleDefault(warehouse)}
                  >
                    {warehouse.isDefault ? "Unset Default" : "Set as Default"}
                  </Button>
                ) : null}
                {canManage ? (
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={pendingIds.has(warehouse.id)}
                    onClick={() => handleToggleActive(warehouse)}
                  >
                    {warehouse.isActive ? "Deactivate" : "Activate"}
                  </Button>
                ) : null}
              </div>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
