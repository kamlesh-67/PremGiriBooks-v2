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
      // Base UI's Select decides controlled-vs-uncontrolled on the first
      // render by checking whether `value` is `undefined` — passing `null`
      // (a distinct, defined "controlled, nothing selected yet" sentinel)
      // instead of `undefined` keeps it controlled for the component's
      // entire lifetime, even before anything is picked. See
      // context/current-error/05-role-select-uncontrolled-to-controlled.md
      // for the reference fix this mirrors.
      value={value ?? (allowNone ? NONE_VALUE : null)}
      onValueChange={(next) => onChange(!next || next === NONE_VALUE ? undefined : next)}
      disabled={disabled}
    >
      <SelectTrigger className="w-full">
        {/*
          Select.Value can't derive a display label from a SelectItem's
          children when they're arbitrary JSX (here, a name + nature badge)
          rather than plain text — with no items/itemToStringLabel wired up
          on the root, it falls back to stringifying the raw `value` (the
          group's uuid). Passing a render function resolves the label from
          `groups` directly instead of relying on that fallback.
        */}
        <SelectValue placeholder={placeholder}>
          {(current: string | null) => {
            if (!current || current === NONE_VALUE) {
              return allowNone ? "No parent (top-level group)" : placeholder;
            }
            const selected = groups.find((group) => group.id === current);
            if (!selected) {
              return placeholder;
            }
            return (
              <span className="flex flex-1 items-center justify-between gap-2">
                <span>{selected.name}</span>
                <AccountNatureBadge nature={selected.natureType} />
              </span>
            );
          }}
        </SelectValue>
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
