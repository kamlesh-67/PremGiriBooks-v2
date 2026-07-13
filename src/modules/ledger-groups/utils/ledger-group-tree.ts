import type { LedgerGroup } from "@prisma/client";
import type { LedgerGroupNode } from "@/types/ledger-group";

/** Builds a parent/child tree from a flat, company-scoped list of groups. */
export function buildLedgerGroupTree(groups: LedgerGroup[]): LedgerGroupNode[] {
  const nodeById = new Map<string, LedgerGroupNode>();
  for (const group of groups) {
    nodeById.set(group.id, { ...group, children: [] });
  }

  const roots: LedgerGroupNode[] = [];
  for (const node of nodeById.values()) {
    if (node.parentGroupId && nodeById.has(node.parentGroupId)) {
      nodeById.get(node.parentGroupId)!.children.push(node);
    } else {
      roots.push(node);
    }
  }

  return roots;
}
