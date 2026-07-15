"use client";

import * as React from "react";
import Link from "next/link";
import { toast } from "sonner";
import { ChevronDown, ChevronRight, Pencil } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  activateCategoryAction,
  deactivateCategoryAction,
} from "@/modules/categories/actions/category-actions";
import { CategoryStatusBadge } from "@/modules/categories/components/category-status-badge";
import type { CategoryNode } from "@/types/category";

interface CategoryTreeProps {
  nodes: CategoryNode[];
  /** Whether the viewer holds the "masters":"edit" permission. */
  canEdit?: boolean;
  /** Whether the viewer holds the "masters":"delete" permission (gates Activate/Deactivate). */
  canManage?: boolean;
}

export function CategoryTree({ nodes, canEdit = false, canManage = false }: CategoryTreeProps) {
  if (nodes.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-border py-16 text-center">
        <p className="text-sm text-muted-foreground">No categories found.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1 rounded-2xl border border-border p-2">
      {nodes.map((node) => (
        <CategoryTreeRow key={node.id} node={node} depth={0} canEdit={canEdit} canManage={canManage} />
      ))}
    </div>
  );
}

interface CategoryTreeRowProps {
  node: CategoryNode;
  depth: number;
  canEdit: boolean;
  canManage: boolean;
}

function CategoryTreeRow({ node, depth, canEdit, canManage }: CategoryTreeRowProps) {
  const [expanded, setExpanded] = React.useState(true);
  const [isPending, setIsPending] = React.useState(false);
  const hasChildren = node.children.length > 0;

  async function handleToggleActive() {
    setIsPending(true);
    const action = node.isActive ? deactivateCategoryAction : activateCategoryAction;

    try {
      const result = await action(node.id);
      if (!result.success) {
        toast.error(result.error ?? "Failed to update category status.");
        return;
      }
      toast.success(node.isActive ? "Category deactivated." : "Category activated.");
    } catch {
      toast.error("Failed to update category status.");
    } finally {
      setIsPending(false);
    }
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
              aria-label={expanded ? "Collapse category" : "Expand category"}
              className="flex h-5 w-5 shrink-0 items-center justify-center text-muted-foreground hover:text-foreground"
            >
              {expanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
            </button>
          ) : (
            <span className="h-5 w-5 shrink-0" />
          )}
          <span className="truncate font-medium text-foreground">{node.name}</span>
          <CategoryStatusBadge isActive={node.isActive} />
        </div>

        <div className="flex shrink-0 items-center gap-2">
          {canEdit ? (
            <Button
              variant="ghost"
              size="icon-sm"
              nativeButton={false}
              render={
                <Link href={`/masters/categories/${node.id}/edit`} aria-label="Edit category">
                  <Pencil size={16} />
                </Link>
              }
            />
          ) : null}
          {canManage ? (
            <Button variant="outline" size="sm" disabled={isPending} onClick={handleToggleActive}>
              {node.isActive ? "Deactivate" : "Activate"}
            </Button>
          ) : null}
        </div>
      </div>

      {hasChildren && expanded
        ? node.children.map((child) => (
            <CategoryTreeRow
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
