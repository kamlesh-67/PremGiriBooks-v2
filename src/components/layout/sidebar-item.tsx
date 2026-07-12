"use client";

import Link from "next/link";
import type { LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface SidebarItemProps {
  icon: LucideIcon;
  label: string;
  collapsed: boolean;
  href?: string;
}

export function SidebarItem({ icon: Icon, label, collapsed, href }: SidebarItemProps) {
  const itemClassName = cn(
    "flex h-9 w-full items-center gap-3 rounded-lg px-3 text-sm text-sidebar-foreground/80 outline-none transition-colors hover:bg-muted hover:text-sidebar-foreground focus-visible:ring-2 focus-visible:ring-ring",
    collapsed && "justify-center px-0"
  );

  const content = (
    <>
      <Icon size={20} className="shrink-0" />
      {!collapsed && <span className="truncate">{label}</span>}
    </>
  );

  const accessibleLabel = collapsed ? label : undefined;

  const button = href ? (
    <Link href={href} className={itemClassName} aria-label={accessibleLabel}>
      {content}
    </Link>
  ) : (
    <button type="button" className={itemClassName} aria-label={accessibleLabel}>
      {content}
    </button>
  );

  if (!collapsed) {
    return button;
  }

  return (
    <Tooltip>
      <TooltipTrigger render={button} />
      <TooltipContent side="right">{label}</TooltipContent>
    </Tooltip>
  );
}
