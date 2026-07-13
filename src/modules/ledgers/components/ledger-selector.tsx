"use client";

import * as React from "react";
import { Check, ChevronsUpDown } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import type { LedgerWithGroup } from "@/types/ledger";

interface LedgerSelectorProps {
  ledgers: LedgerWithGroup[];
  value: string | undefined;
  onChange: (ledgerId: string | undefined) => void;
  placeholder?: string;
  disabled?: boolean;
  /**
   * When true, clicking the currently-selected ledger again clears the
   * selection. Defaults to false — most consumers (a Voucher entry line, a
   * Bank Account's linked ledger) treat "which ledger" as a required choice,
   * where re-clicking the same item should just close the popover and leave
   * the value unchanged, matching LedgerGroupSelector's `allowNone` pattern.
   */
  allowNone?: boolean;
}

/**
 * Reusable Ledger picker — a lightweight combobox (search-as-you-type over
 * name + group, no full listbox library) reused by 15-bank-management.md,
 * 16-expense-heads.md, 17-income-heads.md, and future Voucher/Sales/Purchase
 * screens whenever they need to pick a Ledger.
 */
export function LedgerSelector({
  ledgers,
  value,
  onChange,
  placeholder = "Select a ledger",
  disabled,
  allowNone = false,
}: LedgerSelectorProps) {
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");

  const selected = ledgers.find((ledger) => ledger.id === value);

  const filtered = React.useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) {
      return ledgers;
    }
    return ledgers.filter(
      (ledger) =>
        ledger.name.toLowerCase().includes(normalized) ||
        ledger.ledgerGroup.name.toLowerCase().includes(normalized)
    );
  }, [ledgers, query]);

  function handleSelect(ledgerId: string) {
    const clearing = allowNone && ledgerId === value;
    onChange(clearing ? undefined : ledgerId);
    setOpen(false);
    setQuery("");
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <Button
            type="button"
            variant="outline"
            disabled={disabled}
            className="w-full justify-between font-normal"
          >
            <span className={cn(!selected && "text-muted-foreground")}>
              {selected ? `${selected.name} (${selected.ledgerGroup.name})` : placeholder}
            </span>
            <ChevronsUpDown size={16} className="text-muted-foreground" />
          </Button>
        }
      />
      <PopoverContent align="start" className="w-(--anchor-width) p-0">
        <div className="flex flex-col gap-2 p-2">
          <Input
            autoFocus
            placeholder="Search ledgers…"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
          <div className="flex max-h-64 flex-col overflow-y-auto">
            {filtered.length === 0 ? (
              <p className="px-2 py-4 text-center text-xs text-muted-foreground">
                No ledgers found.
              </p>
            ) : (
              filtered.map((ledger) => (
                <button
                  key={ledger.id}
                  type="button"
                  onClick={() => handleSelect(ledger.id)}
                  className="flex items-center justify-between gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-muted/60"
                >
                  <span className="flex min-w-0 flex-col">
                    <span className="truncate font-medium text-foreground">{ledger.name}</span>
                    <span className="truncate text-xs text-muted-foreground">
                      {ledger.ledgerGroup.name}
                    </span>
                  </span>
                  {ledger.id === value ? (
                    <Check size={16} className="shrink-0 text-primary" />
                  ) : null}
                </button>
              ))
            )}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
