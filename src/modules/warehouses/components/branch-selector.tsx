"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { WarehouseBranchOption } from "@/types/warehouse";

const NONE_VALUE = "__none__";
const NO_BRANCH_LABEL = "No branch";

interface BranchSelectorProps {
  /**
   * The pickable branches — the company's active branches, plus (on edit) the
   * warehouse's current branch even if since deactivated. Empty until Branch
   * Management (12-branch-management.md) is implemented; that renders as
   * "No branches" below, not an error (24-warehouse-management.md's UI).
   */
  branches: WarehouseBranchOption[];
  value: string | undefined;
  onChange: (branchId: string | undefined) => void;
  disabled?: boolean;
  /** Forwarded to the trigger so FormControl can wire label/description/error
   * associations (id, aria-describedby, aria-invalid). */
  id?: string;
  "aria-describedby"?: string;
  "aria-invalid"?: boolean;
}

function branchLabel(branch: WarehouseBranchOption): string {
  // The only inactive entry that can appear here is an edited warehouse's
  // current, since-deactivated branch (kept so the stored value stays
  // visible and re-selectable); mark it so the state isn't invisible —
  // mirroring category-selector.tsx.
  return branch.isActive ? branch.branchName : `${branch.branchName} (Inactive)`;
}

/**
 * Optional-branch picker for the warehouse form, mirroring
 * category-selector.tsx (via ledger-group-selector.tsx).
 */
export function BranchSelector({
  branches,
  value,
  onChange,
  disabled,
  ...triggerProps
}: BranchSelectorProps) {
  return (
    <Select
      // Base UI's Select decides controlled-vs-uncontrolled on the first
      // render by checking whether `value` is `undefined` — NONE_VALUE (a
      // distinct, defined "controlled, nothing selected yet" sentinel) keeps
      // it controlled for the component's entire lifetime; see
      // category-selector.tsx for the reference fix this mirrors.
      value={value ?? NONE_VALUE}
      onValueChange={(next) => onChange(!next || next === NONE_VALUE ? undefined : next)}
      disabled={disabled}
    >
      <SelectTrigger className="w-full" {...triggerProps}>
        <SelectValue placeholder={NO_BRANCH_LABEL}>
          {(current: string | null) => {
            if (!current || current === NONE_VALUE) {
              return NO_BRANCH_LABEL;
            }
            const selected = branches.find((branch) => branch.id === current);
            return selected ? branchLabel(selected) : NO_BRANCH_LABEL;
          }}
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={NONE_VALUE}>{NO_BRANCH_LABEL}</SelectItem>
        {branches.length === 0 ? (
          <SelectItem value="__no_branches__" disabled>
            No branches
          </SelectItem>
        ) : (
          branches.map((branch) => (
            <SelectItem key={branch.id} value={branch.id}>
              {branchLabel(branch)}
            </SelectItem>
          ))
        )}
      </SelectContent>
    </Select>
  );
}
