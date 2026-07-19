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
  activateCustomerAction,
  deactivateCustomerAction,
} from "@/modules/customers/actions/customer-actions";
import { CustomerStatusBadge } from "@/modules/customers/components/customer-status-badge";
import { CustomerTypeBadge } from "@/modules/customers/components/customer-type-badge";
import type { CustomerWithLedger } from "@/types/customer";

interface CustomerTableProps {
  customers: CustomerWithLedger[];
  canEdit?: boolean;
  canManage?: boolean;
}

export function CustomerTable({
  customers,
  canEdit = false,
  canManage = false,
}: CustomerTableProps) {
  // Tracked per row (not a single pending id) so two rows toggled
  // concurrently each keep their own disabled state — the
  // hsn-code-table.tsx review-fix pattern (2026-07-15).
  const [pendingIds, setPendingIds] = React.useState<ReadonlySet<string>>(new Set());

  async function handleToggleActive(customer: CustomerWithLedger) {
    setPendingIds((prev) => new Set(prev).add(customer.id));
    const action = customer.isActive ? deactivateCustomerAction : activateCustomerAction;

    try {
      const result = await action(customer.id);
      if (!result.success) {
        toast.error(result.error ?? "Failed to update customer status.");
        return;
      }
      toast.success(customer.isActive ? "Customer deactivated." : "Customer activated.");
    } catch {
      toast.error("Failed to update customer status.");
    } finally {
      setPendingIds((prev) => {
        const next = new Set(prev);
        next.delete(customer.id);
        return next;
      });
    }
  }

  if (customers.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-border py-16 text-center">
        <p className="text-sm text-muted-foreground">No customers found.</p>
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
          <TableHead>Type</TableHead>
          <TableHead className="text-right">Credit Limit</TableHead>
          <TableHead>Status</TableHead>
          <TableHead className="text-right">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {customers.map((customer) => (
          <TableRow key={customer.id}>
            <TableCell>
              <span className="font-medium text-foreground">{customer.ledger.name}</span>
            </TableCell>
            <TableCell className="font-financial">
              {customer.mobileNumber ?? <span className="text-muted-foreground">—</span>}
            </TableCell>
            <TableCell className="font-financial">
              {customer.gstin ?? <span className="text-muted-foreground">—</span>}
            </TableCell>
            <TableCell>
              <CustomerTypeBadge customerType={customer.customerType} />
            </TableCell>
            <TableCell className="text-right font-financial">
              {customer.creditLimit === null ? (
                <span className="text-muted-foreground">—</span>
              ) : (
                customer.creditLimit.toFixed(2)
              )}
            </TableCell>
            <TableCell>
              <CustomerStatusBadge isActive={customer.isActive} />
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
                        href={`/masters/customers/${customer.id}/edit`}
                        aria-label="Edit customer"
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
                    disabled={pendingIds.has(customer.id)}
                    onClick={() => handleToggleActive(customer)}
                  >
                    {customer.isActive ? "Deactivate" : "Activate"}
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
