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
  activateSupplierAction,
  deactivateSupplierAction,
} from "@/modules/suppliers/actions/supplier-actions";
import { SupplierStatusBadge } from "@/modules/suppliers/components/supplier-status-badge";
import type { SupplierWithLedger } from "@/types/supplier";

interface SupplierTableProps {
  suppliers: SupplierWithLedger[];
  canEdit?: boolean;
  canManage?: boolean;
}

export function SupplierTable({
  suppliers,
  canEdit = false,
  canManage = false,
}: SupplierTableProps) {
  // Tracked per row (not a single pending id) so two rows toggled
  // concurrently each keep their own disabled state — the
  // hsn-code-table.tsx review-fix pattern, mirrored from customer-table.tsx.
  const [pendingIds, setPendingIds] = React.useState<ReadonlySet<string>>(new Set());

  async function handleToggleActive(supplier: SupplierWithLedger) {
    setPendingIds((prev) => new Set(prev).add(supplier.id));
    const action = supplier.isActive ? deactivateSupplierAction : activateSupplierAction;

    try {
      const result = await action(supplier.id);
      if (!result.success) {
        toast.error(result.error ?? "Failed to update supplier status.");
        return;
      }
      toast.success(supplier.isActive ? "Supplier deactivated." : "Supplier activated.");
    } catch {
      toast.error("Failed to update supplier status.");
    } finally {
      setPendingIds((prev) => {
        const next = new Set(prev);
        next.delete(supplier.id);
        return next;
      });
    }
  }

  if (suppliers.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-border py-16 text-center">
        <p className="text-sm text-muted-foreground">No suppliers found.</p>
      </div>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Name</TableHead>
          <TableHead>Mobile</TableHead>
          <TableHead>GSTIN</TableHead>
          <TableHead className="text-right">Credit Days</TableHead>
          <TableHead>Status</TableHead>
          <TableHead className="text-right">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {suppliers.map((supplier) => (
          <TableRow key={supplier.id}>
            <TableCell>
              <span className="font-medium text-foreground">{supplier.ledger.name}</span>
            </TableCell>
            <TableCell className="font-financial">
              {supplier.mobileNumber ?? <span className="text-muted-foreground">—</span>}
            </TableCell>
            <TableCell className="font-financial">
              {supplier.gstin ?? <span className="text-muted-foreground">—</span>}
            </TableCell>
            <TableCell className="text-right font-financial">
              {supplier.creditDays ?? <span className="text-muted-foreground">—</span>}
            </TableCell>
            <TableCell>
              <SupplierStatusBadge isActive={supplier.isActive} />
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
                        href={`/masters/suppliers/${supplier.id}/edit`}
                        aria-label="Edit supplier"
                      >
                        <Pencil size={16} />
                      </Link>
                    }
                  />
                ) : null}
                {canManage ? (
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={pendingIds.has(supplier.id)}
                    onClick={() => handleToggleActive(supplier)}
                  >
                    {supplier.isActive ? "Deactivate" : "Activate"}
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
