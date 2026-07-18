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
import { PRODUCT_TYPE_LABELS } from "@/modules/products/components/product-type-badge";
import { PRODUCT_TYPE_VALUES } from "@/modules/products/validation/product-schema";
import type { ProductMasterOption } from "@/types/product";

const ALL_VALUE = "all";
const SEARCH_DEBOUNCE_MS = 300;

interface ProductFilterBarProps {
  /** Active categories/brands for the filter dropdowns. */
  categories: ProductMasterOption[];
  brands: ProductMasterOption[];
}

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
 * Search + type/category/brand/status filters for the product list
 * (25-product-management.md's UI). Filter state lives in the URL so the
 * server page re-queries through productService.listProducts(filters) and
 * the view stays shareable/bookmarkable.
 */
export function ProductFilterBar({ categories, brands }: ProductFilterBarProps) {
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
        placeholder="Search name, code, or barcode…"
        className="sm:max-w-xs"
        aria-label="Search products"
      />

      <FilterSelect
        value={searchParams.get("type") ?? ALL_VALUE}
        onChange={(value) => updateParams({ type: value })}
        allLabel="All Types"
        ariaLabel="Filter by product type"
        options={PRODUCT_TYPE_VALUES.map((value) => ({
          value,
          label: PRODUCT_TYPE_LABELS[value],
        }))}
      />

      <FilterSelect
        value={searchParams.get("category") ?? ALL_VALUE}
        onChange={(value) => updateParams({ category: value })}
        allLabel="All Categories"
        ariaLabel="Filter by category"
        options={categories.map((category) => ({ value: category.id, label: category.name }))}
      />

      <FilterSelect
        value={searchParams.get("brand") ?? ALL_VALUE}
        onChange={(value) => updateParams({ brand: value })}
        allLabel="All Brands"
        ariaLabel="Filter by brand"
        options={brands.map((brand) => ({ value: brand.id, label: brand.name }))}
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
