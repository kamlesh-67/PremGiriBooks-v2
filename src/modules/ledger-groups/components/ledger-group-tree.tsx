"use client";

import * as React from "react";
import Link from "next/link";
import { toast } from "sonner";
import { ChevronDown, ChevronRight, Pencil } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  activateLedgerGroupAction,
  deactivateLedgerGroupAction,
} from "@/modules/ledger-groups/actions/ledger-group-actions";
import { AccountNatureBadge } from "@/modules/ledger-groups/components/account-nature-badge";
import { LedgerGroupStatusBadge } from "@/modules/ledger-groups/components/ledger-group-status-badge";
import type { LedgerGroupNode } from "@/types/ledger-group";

interface LedgerGroupTreeProps {
  nodes: LedgerGroupNode[];
  /** Whether the viewer holds the "accounting":"edit" permission. */
  canEdit?: boolean;
  /** Whether the viewer holds the "accounting":"delete" permission (gates Activate/Deactivate). */
  canManage?: boolean;
}

export function LedgerGroupTree({ nodes, canEdit = false, canManage = false }: LedgerGroupTreeProps) {
  if (nodes.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-border py-16 text-center">
        <p className="text-sm text-muted-foreground">No ledger groups found.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1 rounded-2xl border border-border p-2">
      {nodes.map((node) => (
        <LedgerGroupTreeRow key={node.id} node={node} depth={0} canEdit={canEdit} canManage={canManage} />
      ))}
    </div>
  );
}

interface LedgerGroupTreeRowProps {
  node: LedgerGroupNode;
  depth: number;
  canEdit: boolean;
  canManage: boolean;
}

function LedgerGroupTreeRow({ node, depth, canEdit, canManage }: LedgerGroupTreeRowProps) {
  const [expanded, setExpanded] = React.useState(true);
  const [isPending, setIsPending] = React.useState(false);
  const hasChildren = node.children.length > 0;

  async function handleToggleActive() {
    setIsPending(true);
    const action = node.isActive ? deactivateLedgerGroupAction : activateLedgerGroupAction;
    const result = await action(node.id);
    setIsPending(false);

    if (!result.success) {
      toast.error(result.error ?? "Failed to update ledger group status.");
      return;
    }

    toast.success(node.isActive ? "Ledger group deactivated." : "Ledger group activated.");
  }

  return (
    <div className="flex flex-col">
      <div
        className="flex items-center justify-between gap-2 rounded-lg px-2 py-2 hover:bg-muted/40"
        style={{ paddingLeft: depth * 20 + 8 }}
      >
        <div className="flex min-w-0 items-center gap-2">
          {hasChildren ? (
            <button
              type="button"
              onClick={() => setExpanded((prev) => !prev)}
              aria-label={expanded ? "Collapse group" : "Expand group"}
              className="flex h-5 w-5 shrink-0 items-center justify-center text-muted-foreground hover:text-foreground"
            >
              {expanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
            </button>
          ) : (
            <span className="h-5 w-5 shrink-0" />
          )}
          <span className="truncate font-medium text-foreground">{node.name}</span>
          <AccountNatureBadge nature={node.natureType} />
          {node.isSystemDefined ? <Badge variant="secondary">System</Badge> : null}
          <LedgerGroupStatusBadge isActive={node.isActive} />
        </div>

        <div className="flex shrink-0 items-center gap-2">
          {canEdit ? (
            <Button
              variant="ghost"
              size="icon-sm"
              nativeButton={false}
              render={
                <Link href={`/accounting/ledger-groups/${node.id}/edit`} aria-label="Edit ledger group">
                  <Pencil size={16} />
                </Link>
              }
            />
          ) : null}
          {node.isSystemDefined || !canManage ? null : (
            <Button
              variant="outline"
              size="sm"
              disabled={isPending}
              onClick={handleToggleActive}
            >
              {node.isActive ? "Deactivate" : "Activate"}
            </Button>
          )}
        </div>
      </div>

      {hasChildren && expanded
        ? node.children.map((child) => (
            <LedgerGroupTreeRow
              key={child.id}
              node={child}
              depth={depth + 1}
              canEdit={canEdit}
              canManage={canManage}
            />
          ))
        : null}
    </div>
  );
}
