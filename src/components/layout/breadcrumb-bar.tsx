"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ArrowLeft, ChevronRight, Home } from "lucide-react";

import { Button } from "@/components/ui/button";
import { BREADCRUMB_ID_PATTERN, BREADCRUMB_LABELS } from "@/constants/breadcrumbs";
import { cn } from "@/lib/utils";

interface Crumb {
  label: string;
  href: string;
}

function toLabel(segment: string): string {
  const known = BREADCRUMB_LABELS[segment];
  if (known) {
    return known;
  }
  return segment
    .split("-")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function buildTrail(pathname: string): Crumb[] {
  const segments = pathname.split("/").filter(Boolean);
  const crumbs: Crumb[] = [];
  let href = "";

  for (const segment of segments) {
    href += `/${segment}`;
    // A resource id (uuid) isn't meaningful on its own without fetching the
    // entity it points at — dropped from the visible trail, but its parent
    // href still carries it forward so the *next* segment (e.g. "edit")
    // links correctly.
    if (BREADCRUMB_ID_PATTERN.test(segment)) {
      continue;
    }
    crumbs.push({ label: toLabel(segment), href });
  }

  return crumbs;
}

export function BreadcrumbBar() {
  const pathname = usePathname();
  const router = useRouter();
  const crumbs = buildTrail(pathname);

  return (
    <div className="flex h-10 shrink-0 items-center gap-2 border-b border-border bg-background px-4 text-sm">
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label="Go back"
        onClick={() => router.back()}
      >
        <ArrowLeft size={16} />
      </Button>

      <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 overflow-x-auto">
        <Link
          href="/"
          className="flex items-center text-muted-foreground transition-colors hover:text-foreground"
          aria-label="Dashboard"
        >
          <Home size={14} />
        </Link>

        {crumbs.map((crumb, index) => {
          const isLast = index === crumbs.length - 1;
          return (
            <React.Fragment key={crumb.href}>
              <ChevronRight size={14} className="shrink-0 text-muted-foreground" />
              {isLast ? (
                <span className="font-medium text-foreground">{crumb.label}</span>
              ) : (
                <Link
                  href={crumb.href}
                  className={cn("text-muted-foreground transition-colors hover:text-foreground")}
                >
                  {crumb.label}
                </Link>
              )}
            </React.Fragment>
          );
        })}
      </nav>
    </div>
  );
}
