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

const ALL_VALUE = "all";
const SEARCH_DEBOUNCE_MS = 300;

/**
 * Search + status filter for the supplier list (27-supplier-management.md's
 * UI) — the customer-filter-bar.tsx pattern with the type filter dropped
 * (Supplier has no supplierType). Filter state lives in the URL so the
 * server page re-queries through supplierService.listSuppliers(filters).
 */
export function SupplierFilterBar() {
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
        aria-label="Search suppliers"
      />

      <Select
        value={searchParams.get("status") ?? ALL_VALUE}
        onValueChange={(value) => updateParams({ status: value ?? ALL_VALUE })}
      >
        <SelectTrigger className="w-full sm:w-44" aria-label="Filter by status">
          <SelectValue>
            {(current: string | null) =>
              current === "active" ? "Active" : current === "inactive" ? "Inactive" : "All Statuses"
            }
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL_VALUE}>All Statuses</SelectItem>
          <SelectItem value="active">Active</SelectItem>
          <SelectItem value="inactive">Inactive</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}
