"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface UserSearchFormProps {
  initialSearch: string;
}

export function UserSearchForm({ initialSearch }: UserSearchFormProps) {
  const router = useRouter();
  const [search, setSearch] = React.useState(initialSearch);

  function applyFilters(nextSearch: string) {
    const params = new URLSearchParams();
    if (nextSearch) {
      params.set("search", nextSearch);
    }

    const query = params.toString();
    router.push(query ? `/settings/users?${query}` : "/settings/users");
  }

  return (
    <form
      className="flex flex-wrap items-center gap-2"
      onSubmit={(event) => {
        event.preventDefault();
        applyFilters(search);
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
          placeholder="Search by name, username, email, or role"
          aria-label="Search users"
          className="w-80 pl-8"
        />
      </div>

      <Button type="submit" variant="secondary" size="sm">
        Search
      </Button>
    </form>
  );
}
