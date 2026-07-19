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
import type { ActionResult } from "@/types/api";
import type { Ledger, LedgerWithGroup } from "@/types/ledger";

interface LedgerTableProps {
  ledgers: LedgerWithGroup[];
  canEdit?: boolean;
  canManage?: boolean;
  /** Route prefix the Edit link points at; defaults to the generic Ledger screens. */
  editBasePath?: string;
  /** Noun used in toasts and the empty state, e.g. "Expense Head". */
  entityLabel?: string;
  /** Server Actions for the status toggle; default to the generic Ledger ones. */
  activateAction?: (id: string) => Promise<ActionResult<Ledger>>;
  deactivateAction?: (id: string) => Promise<ActionResult<Ledger>>;
  /** Ledgers paired with a BankAccount/Customer detail row — their Edit and
   * status controls are replaced with a "managed via …" hint because they
   * change only through Bank/Customer Management's combined form
   * (26-customer-management.md). */
  detailManaged?: { id: string; link: "bankAccount" | "customer" }[];
}

const DETAIL_MANAGED_HINTS: Record<"bankAccount" | "customer", string> = {
  bankAccount: "Managed via Bank Management",
  customer: "Managed via Customer Management",
};

export function LedgerTable({
  ledgers,
  canEdit = false,
  canManage = false,
  editBasePath = "/accounting/ledgers",
  entityLabel = "Ledger",
  activateAction = activateLedgerAction,
  deactivateAction = deactivateLedgerAction,
  detailManaged,
}: LedgerTableProps) {
  const [pendingId, setPendingId] = React.useState<string | null>(null);
  const entityLower = entityLabel.toLowerCase();
  const managedLinks = React.useMemo(
    () => new Map((detailManaged ?? []).map((entry) => [entry.id, entry.link])),
    [detailManaged]
  );

  async function handleToggleActive(ledger: LedgerWithGroup) {
    setPendingId(ledger.id);
    const action = ledger.isActive ? deactivateAction : activateAction;

    try {
      const result = await action(ledger.id);
      if (!result.success) {
        toast.error(result.error ?? `Failed to update ${entityLower} status.`);
        return;
      }
      toast.success(ledger.isActive ? `${entityLabel} deactivated.` : `${entityLabel} activated.`);
    } catch {
      toast.error(`Failed to update ${entityLower} status.`);
    } finally {
      setPendingId(null);
    }
  }

  if (ledgers.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-border py-16 text-center">
        <p className="text-sm text-muted-foreground">No {entityLower}s found.</p>
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
              <div className="flex items-center justify-end gap-2">
                {managedLinks.has(ledger.id) ? (
                  <span className="text-xs text-muted-foreground">
                    {DETAIL_MANAGED_HINTS[managedLinks.get(ledger.id) ?? "customer"]}
                  </span>
                ) : (
                  <>
                    {canEdit ? (
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        nativeButton={false}
                        render={
                          <Link
                            href={`${editBasePath}/${ledger.id}/edit`}
                            aria-label={`Edit ${entityLower}`}
                          >
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
                  </>
                )}
              </div>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
