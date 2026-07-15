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
  activateGstRateAction,
  deactivateGstRateAction,
} from "@/modules/gst-rates/actions/gst-rate-actions";
import { GstRateStatusBadge } from "@/modules/gst-rates/components/gst-rate-status-badge";
import type { GstRate } from "@/types/gst-rate";

interface GstRateTableProps {
  gstRates: GstRate[];
  canEdit?: boolean;
  canManage?: boolean;
}

export function GstRateTable({ gstRates, canEdit = false, canManage = false }: GstRateTableProps) {
  // Tracked per row (not a single pending id) so two rows toggled
  // concurrently each keep their own disabled state — a lone id would be
  // overwritten by the second click and cleared by whichever action finishes
  // first, re-enabling the still-in-flight row's button (the
  // hsn-code-table.tsx review fix, 2026-07-15).
  const [pendingIds, setPendingIds] = React.useState<ReadonlySet<string>>(new Set());

  async function handleToggleActive(gstRate: GstRate) {
    setPendingIds((prev) => new Set(prev).add(gstRate.id));
    const action = gstRate.isActive ? deactivateGstRateAction : activateGstRateAction;

    try {
      const result = await action(gstRate.id);
      if (!result.success) {
        toast.error(result.error ?? "Failed to update GST rate status.");
        return;
      }
      toast.success(gstRate.isActive ? "GST rate deactivated." : "GST rate activated.");
    } catch {
      toast.error("Failed to update GST rate status.");
    } finally {
      setPendingIds((prev) => {
        const next = new Set(prev);
        next.delete(gstRate.id);
        return next;
      });
    }
  }

  if (gstRates.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-border py-16 text-center">
        <p className="text-sm text-muted-foreground">No GST rates found.</p>
      </div>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Name</TableHead>
          <TableHead className="text-right">Rate %</TableHead>
          <TableHead className="text-right">Cess %</TableHead>
          <TableHead>Status</TableHead>
          <TableHead className="text-right">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {gstRates.map((gstRate) => (
          <TableRow key={gstRate.id}>
            <TableCell>
              <span className="font-medium text-foreground">{gstRate.name}</span>
            </TableCell>
            <TableCell className="text-right font-financial">
              {gstRate.ratePercent.toFixed(2)}
            </TableCell>
            <TableCell className="text-right font-financial">
              {gstRate.cessPercent.toFixed(2)}
            </TableCell>
            <TableCell>
              <GstRateStatusBadge isActive={gstRate.isActive} />
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
                        href={`/masters/gst-rates/${gstRate.id}/edit`}
                        aria-label="Edit GST rate"
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
                    disabled={pendingIds.has(gstRate.id)}
                    onClick={() => handleToggleActive(gstRate)}
                  >
                    {gstRate.isActive ? "Deactivate" : "Activate"}
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
