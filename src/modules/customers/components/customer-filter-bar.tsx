"use client";

import * as React from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CUSTOMER_TYPE_LABELS } from "@/modules/customers/components/customer-type-badge";
import { CUSTOMER_TYPE_VALUES } from "@/modules/customers/validation/customer-schema";

const ALL_VALUE = "all";
const SEARCH_DEBOUNCE_MS = 300;

interface FilterSelectProps {
  value: string;
  onChange: (value: string) => void;
  allLabel: string;
  options: { value: string; label: string }[];
  ariaLabel: string;
}

function FilterSelect({ value, onChange, allLabel, options, ariaLabel }: FilterSelectProps) {
  return (
    <Select value={value} onValueChange={(next) => onChange(next ?? ALL_VALUE)}>
      <SelectTrigger className="w-full sm:w-44" aria-label={ariaLabel}>
        <SelectValue>
          {(current: string | null) =>
            options.find((option) => option.value === current)?.label ?? allLabel
          }
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={ALL_VALUE}>{allLabel}</SelectItem>
        {options.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

/**
 * Search + type/status filters for the customer list
 * (26-customer-management.md's UI). Filter state lives in the URL so the
 * server page re-queries through customerService.listCustomers(filters) —
 * the ProductFilterBar URL-state pattern from 25-product-management.md.
 */
export function CustomerFilterBar() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [search, setSearch] = React.useState(searchParams.get("search") ?? "");

  const updateParams = React.useCallback(
    (updates: Record<string, string | undefined>) => {
      const params = new URLSearchParams(searchParams);
      for (const [key, value] of Object.entries(updates)) {
        if (!value || value === ALL_VALUE) {
          params.delete(key);
        } else {
          params.set(key, value);
        }
      }
      const query = params.toString();
      router.replace(query ? `${pathname}?${query}` : pathname);
    },
    [router, pathname, searchParams]
  );

  // Debounced so each keystroke doesn't trigger a server round-trip; the
  // guard skips the redundant replace when the URL already matches (e.g. on
  // mount or after back-navigation).
  React.useEffect(() => {
    const current = searchParams.get("search") ?? "";
    if (search === current) {
      return;
    }
    const handle = setTimeout(() => {
      updateParams({ search: search || undefined });
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(handle);
  }, [search, searchParams, updateParams]);

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
      <Input
        value={search}
        onChange={(event) => setSearch(event.target.value)}
        placeholder="Search name, mobile, or GSTIN…"
        className="sm:max-w-xs"
        aria-label="Search customers"
      />

      <FilterSelect
        value={searchParams.get("type") ?? ALL_VALUE}
        onChange={(value) => updateParams({ type: value })}
        allLabel="All Types"
        ariaLabel="Filter by customer type"
        options={CUSTOMER_TYPE_VALUES.map((value) => ({
          value,
          label: CUSTOMER_TYPE_LABELS[value],
        }))}
      />

      <FilterSelect
        value={searchParams.get("status") ?? ALL_VALUE}
        onChange={(value) => updateParams({ status: value })}
        allLabel="All Statuses"
        ariaLabel="Filter by status"
        options={[
          { value: "active", label: "Active" },
          { value: "inactive", label: "Inactive" },
        ]}
      />
    </div>
  );
}
