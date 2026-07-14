"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { CompanyStatusFilter } from "@/types/company";

interface CompanySearchFormProps {
  initialSearch: string;
  initialStatus: CompanyStatusFilter;
  basePath?: string;
}

export function CompanySearchForm({
  initialSearch,
  initialStatus,
  basePath = "/company",
}: CompanySearchFormProps) {
  const router = useRouter();
  const [search, setSearch] = React.useState(initialSearch);
  const [status, setStatus] = React.useState<CompanyStatusFilter>(initialStatus);

  function applyFilters(nextSearch: string, nextStatus: CompanyStatusFilter) {
    const params = new URLSearchParams();
    if (nextSearch) {
      params.set("search", nextSearch);
    }
    if (nextStatus !== "all") {
      params.set("status", nextStatus);
    }

    const query = params.toString();
    router.push(query ? `${basePath}?${query}` : basePath);
  }

  return (
    <form
      className="flex flex-wrap items-center gap-2"
      onSubmit={(event) => {
        event.preventDefault();
        applyFilters(search, status);
      }}
    >
      <div className="relative">
        <Search
          size={16}
          className="pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 text-muted-foreground"
        />
        <Input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search by name, GSTIN, or mobile number"
          aria-label="Search companies"
          className="w-72 pl-8"
        />
      </div>

      <Select
        value={status}
        onValueChange={(value) => {
          const nextStatus = value as CompanyStatusFilter;
          setStatus(nextStatus);
          applyFilters(search, nextStatus);
        }}
      >
        <SelectTrigger className="w-36">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Statuses</SelectItem>
          <SelectItem value="active">Active</SelectItem>
          <SelectItem value="inactive">Inactive</SelectItem>
        </SelectContent>
      </Select>

      <Button type="submit" variant="secondary" size="sm">
        Search
      </Button>
    </form>
  );
}
