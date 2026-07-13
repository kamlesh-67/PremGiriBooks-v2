"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { AccountNatureBadge } from "@/modules/ledger-groups/components/account-nature-badge";
import type { LedgerGroup } from "@/types/ledger-group";

const NONE_VALUE = "__none__";

interface LedgerGroupSelectorProps {
  groups: LedgerGroup[];
  value: string | undefined;
  onChange: (groupId: string | undefined) => void;
  placeholder?: string;
  disabled?: boolean;
  /** When true, shows a "No parent (top-level group)" option. */
  allowNone?: boolean;
}

/**
 * Reusable parent-group picker — also reused by 14-ledger-master.md's Ledger
 * Form to pick a Ledger's group. Flat, alphabetical; each item shows the
 * group's Nature so the same list stays legible regardless of hierarchy.
 */
export function LedgerGroupSelector({
  groups,
  value,
  onChange,
  placeholder = "Select a group",
  disabled,
  allowNone = true,
}: LedgerGroupSelectorProps) {
  return (
    <Select
      value={value ?? (allowNone ? NONE_VALUE : undefined)}
      onValueChange={(next) => onChange(!next || next === NONE_VALUE ? undefined : next)}
      disabled={disabled}
    >
      <SelectTrigger className="w-full">
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {allowNone ? (
          <SelectItem value={NONE_VALUE}>No parent (top-level group)</SelectItem>
        ) : null}
        {groups.map((group) => (
          <SelectItem key={group.id} value={group.id}>
            <span className="flex flex-1 items-center justify-between gap-2">
              <span>{group.name}</span>
              <AccountNatureBadge nature={group.natureType} />
            </span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
