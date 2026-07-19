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
import { CUSTOMER_TYPE_LABELS } from "@/modules/customers/components/customer-type-badge";
import {
  activatePriceListAction,
  deactivatePriceListAction,
} from "@/modules/price-lists/actions/price-list-actions";
import { PriceListStatusBadge } from "@/modules/price-lists/components/price-list-status-badge";
import { formatEffectiveWindow } from "@/modules/price-lists/utils/format-price-list-date";
import type { PriceListWithItemCount } from "@/types/price-list";

interface PriceListTableProps {
  priceLists: PriceListWithItemCount[];
  canEdit?: boolean;
  canManage?: boolean;
}

export function PriceListTable({
  priceLists,
  canEdit = false,
  canManage = false,
}: PriceListTableProps) {
  // Tracked per row (not a single pending id) so two rows toggled
  // concurrently each keep their own disabled state — the
  // margin-profile-table.tsx convention.
  const [pendingIds, setPendingIds] = React.useState<ReadonlySet<string>>(new Set());

  async function handleToggleActive(priceList: PriceListWithItemCount) {
    setPendingIds((prev) => new Set(prev).add(priceList.id));
    const action = priceList.isActive ? deactivatePriceListAction : activatePriceListAction;

    try {
      const result = await action(priceList.id);
      if (!result.success) {
        toast.error(result.error ?? "Failed to update price list status.");
        return;
      }
      toast.success(priceList.isActive ? "Price list deactivated." : "Price list activated.");
    } catch {
      toast.error("Failed to update price list status.");
    } finally {
      setPendingIds((prev) => {
        const next = new Set(prev);
        next.delete(priceList.id);
        return next;
      });
    }
  }

  if (priceLists.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-border py-16 text-center">
        <p className="text-sm text-muted-foreground">No price lists found.</p>
      </div>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Name</TableHead>
          <TableHead>Tier</TableHead>
          <TableHead>Effective Window</TableHead>
          <TableHead className="text-right">Items</TableHead>
          <TableHead>Status</TableHead>
          <TableHead className="text-right">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {priceLists.map((priceList) => (
          <TableRow key={priceList.id}>
            <TableCell>
              <span className="font-medium text-foreground">{priceList.name}</span>
            </TableCell>
            <TableCell>
              {priceList.customerType ? CUSTOMER_TYPE_LABELS[priceList.customerType] : "—"}
            </TableCell>
            <TableCell>
              {formatEffectiveWindow(priceList.effectiveFrom, priceList.effectiveTo)}
            </TableCell>
            <TableCell className="text-right font-financial">{priceList.itemCount}</TableCell>
            <TableCell>
              <PriceListStatusBadge isActive={priceList.isActive} />
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
                        href={`/masters/price-lists/${priceList.id}/edit`}
                        aria-label="Edit price list"
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
                    disabled={pendingIds.has(priceList.id)}
                    onClick={() => handleToggleActive(priceList)}
                  >
                    {priceList.isActive ? "Deactivate" : "Activate"}
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
