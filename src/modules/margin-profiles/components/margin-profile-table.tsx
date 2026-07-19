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
  activateMarginProfileAction,
  deactivateMarginProfileAction,
} from "@/modules/margin-profiles/actions/margin-profile-actions";
import { MarginProfileModeBadge } from "@/modules/margin-profiles/components/margin-profile-mode-badge";
import { MarginProfileStatusBadge } from "@/modules/margin-profiles/components/margin-profile-status-badge";
import type { MarginProfile } from "@/types/margin-profile";

interface MarginProfileTableProps {
  marginProfiles: MarginProfile[];
  canEdit?: boolean;
  canManage?: boolean;
}

export function MarginProfileTable({
  marginProfiles,
  canEdit = false,
  canManage = false,
}: MarginProfileTableProps) {
  // Tracked per row (not a single pending id) so two rows toggled
  // concurrently each keep their own disabled state — the gst-rate-table.tsx
  // convention (hsn-code-table.tsx review fix, 2026-07-15).
  const [pendingIds, setPendingIds] = React.useState<ReadonlySet<string>>(new Set());

  async function handleToggleActive(marginProfile: MarginProfile) {
    setPendingIds((prev) => new Set(prev).add(marginProfile.id));
    const action = marginProfile.isActive
      ? deactivateMarginProfileAction
      : activateMarginProfileAction;

    try {
      const result = await action(marginProfile.id);
      if (!result.success) {
        toast.error(result.error ?? "Failed to update margin profile status.");
        return;
      }
      toast.success(
        marginProfile.isActive ? "Margin profile deactivated." : "Margin profile activated."
      );
    } catch {
      toast.error("Failed to update margin profile status.");
    } finally {
      setPendingIds((prev) => {
        const next = new Set(prev);
        next.delete(marginProfile.id);
        return next;
      });
    }
  }

  if (marginProfiles.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-border py-16 text-center">
        <p className="text-sm text-muted-foreground">No margin profiles found.</p>
      </div>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Name</TableHead>
          <TableHead>Mode</TableHead>
          <TableHead className="text-right">Retail %</TableHead>
          <TableHead className="text-right">Wholesale %</TableHead>
          <TableHead className="text-right">Dealer %</TableHead>
          <TableHead className="text-right">Distributor %</TableHead>
          <TableHead>Status</TableHead>
          <TableHead className="text-right">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {marginProfiles.map((marginProfile) => (
          <TableRow key={marginProfile.id}>
            <TableCell>
              <span className="font-medium text-foreground">{marginProfile.name}</span>
            </TableCell>
            <TableCell>
              <MarginProfileModeBadge calculationMode={marginProfile.calculationMode} />
            </TableCell>
            <TableCell className="text-right font-financial">
              {marginProfile.retailPercent.toFixed(2)}
            </TableCell>
            <TableCell className="text-right font-financial">
              {marginProfile.wholesalePercent.toFixed(2)}
            </TableCell>
            <TableCell className="text-right font-financial">
              {marginProfile.dealerPercent.toFixed(2)}
            </TableCell>
            <TableCell className="text-right font-financial">
              {marginProfile.distributorPercent.toFixed(2)}
            </TableCell>
            <TableCell>
              <MarginProfileStatusBadge isActive={marginProfile.isActive} />
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
                        href={`/masters/margin-profiles/${marginProfile.id}/edit`}
                        aria-label="Edit margin profile"
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
                    disabled={pendingIds.has(marginProfile.id)}
                    onClick={() => handleToggleActive(marginProfile)}
                  >
                    {marginProfile.isActive ? "Deactivate" : "Activate"}
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
