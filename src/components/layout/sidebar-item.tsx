"use client";

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
}

export function SidebarItem({ icon: Icon, label, collapsed }: SidebarItemProps) {
  const button = (
    <button
      type="button"
      className={cn(
        "flex h-9 w-full items-center gap-3 rounded-lg px-3 text-sm text-sidebar-foreground/80 outline-none transition-colors hover:bg-muted hover:text-sidebar-foreground focus-visible:ring-2 focus-visible:ring-ring",
        collapsed && "justify-center px-0"
      )}
    >
      <Icon size={20} className="shrink-0" />
      {!collapsed && <span className="truncate">{label}</span>}
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
