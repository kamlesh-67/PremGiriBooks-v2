"use client";

import * as React from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Pencil } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { activateLedgerAction, deactivateLedgerAction } from "@/modules/ledgers/actions/ledger-actions";
import { LedgerStatusBadge } from "@/modules/ledgers/components/ledger-status-badge";
import type { LedgerWithGroup } from "@/types/ledger";

interface LedgerTableProps {
  ledgers: LedgerWithGroup[];
  canEdit?: boolean;
  canManage?: boolean;
}

export function LedgerTable({ ledgers, canEdit = false, canManage = false }: LedgerTableProps) {
  const [pendingId, setPendingId] = React.useState<string | null>(null);

  async function handleToggleActive(ledger: LedgerWithGroup) {
    setPendingId(ledger.id);
    const action = ledger.isActive ? deactivateLedgerAction : activateLedgerAction;
    const result = await action(ledger.id);
    setPendingId(null);

    if (!result.success) {
      toast.error(result.error ?? "Failed to update ledger status.");
      return;
    }

    toast.success(ledger.isActive ? "Ledger deactivated." : "Ledger activated.");
  }

  if (ledgers.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-border py-16 text-center">
        <p className="text-sm text-muted-foreground">No ledgers found.</p>
      </div>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Name</TableHead>
          <TableHead>Ledger Group</TableHead>
          <TableHead className="text-right">Opening Balance</TableHead>
          <TableHead>Status</TableHead>
          <TableHead className="text-right">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {ledgers.map((ledger) => (
          <TableRow key={ledger.id}>
            <TableCell>
              <div className="flex items-center gap-2">
                <span className="font-medium text-foreground">{ledger.name}</span>
                {ledger.isSystemDefined ? <Badge variant="secondary">System</Badge> : null}
              </div>
            </TableCell>
            <TableCell>{ledger.ledgerGroup.name}</TableCell>
            <TableCell className="text-right font-financial">
              {ledger.openingBalance.toFixed(2)} {ledger.openingBalanceType === "DEBIT" ? "Dr" : "Cr"}
            </TableCell>
            <TableCell>
              <LedgerStatusBadge isActive={ledger.isActive} />
            </TableCell>
            <TableCell className="text-right">
              <div className="flex justify-end gap-2">
                {canEdit ? (
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    nativeButton={false}
                    render={
                      <Link href={`/accounting/ledgers/${ledger.id}/edit`} aria-label="Edit ledger">
                        <Pencil size={16} />
                      </Link>
                    }
                  />
                ) : null}
                {ledger.isSystemDefined || !canManage ? null : (
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={pendingId === ledger.id}
                    onClick={() => handleToggleActive(ledger)}
                  >
                    {ledger.isActive ? "Deactivate" : "Activate"}
                  </Button>
                )}
              </div>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
