"use client";

import { BookOpen, Search, Bell, User } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ThemeToggle } from "@/components/common/theme-toggle";

export function TopNavbar() {
  return (
    <header className="flex h-14 shrink-0 items-center gap-4 border-b border-border bg-navbar px-4 text-navbar-foreground">
      <div className="flex shrink-0 items-center gap-2">
        <BookOpen size={22} className="text-primary" />
        <span className="text-sm font-semibold tracking-tight">
          Premgiri Books
        </span>
      </div>

      <div className="flex flex-1 justify-center px-4">
        <div className="relative w-full max-w-md">
          <Search
            size={18}
            className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            type="search"
            disabled
            placeholder="Search products, customers, invoices..."
            className="pl-9"
            aria-label="Global search"
          />
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-1">
        <ThemeToggle />
        <Button variant="ghost" size="icon" aria-label="Notifications" disabled>
          <Bell size={18} />
        </Button>
        <Button variant="ghost" size="icon" aria-label="User menu" disabled>
          <User size={18} />
        </Button>
      </div>
    </header>
  );
}
