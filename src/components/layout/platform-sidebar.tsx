"use client";

import {
  Building2,
  ShieldCheck,
  KeyRound,
  Settings,
  ScrollText,
  DatabaseBackup,
  ChevronsLeft,
  ChevronsRight,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { SidebarItem } from "@/components/layout/sidebar-item";

// Every item here is reachable only by a PLATFORM user (Super Admin) —
// proxy.ts never lets a COMPANY user reach /administration/**, so unlike
// the ERP Sidebar's NAV_ITEMS, nothing here needs an adminOnly-style
// visibility filter. Licenses/Platform Settings/Audit/Backup link to
// "Coming soon" placeholders, per architecture-Migration-Super-Admin-
// Administration-Implementation-Plan.md's confirmed Platform module scope.
const PLATFORM_NAV_ITEMS = [
  { icon: Building2, label: "Companies", href: "/administration/companies" },
  { icon: ShieldCheck, label: "Company Admins", href: "/administration/company-admins" },
  { icon: KeyRound, label: "Licenses", href: "/administration/licenses" },
  { icon: Settings, label: "Platform Settings", href: "/administration/settings" },
  { icon: ScrollText, label: "Audit", href: "/administration/audit" },
  { icon: DatabaseBackup, label: "Backup", href: "/administration/backup" },
] as const;

interface PlatformSidebarProps {
  collapsed: boolean;
  onToggle: () => void;
}

export function PlatformSidebar({ collapsed, onToggle }: PlatformSidebarProps) {
  return (
    <nav
      aria-label="Platform"
      className={cn(
        "flex h-full shrink-0 flex-col border-r border-border bg-sidebar transition-[width] duration-150",
        collapsed ? "w-16" : "w-60"
      )}
    >
      <div className="flex h-12 shrink-0 items-center justify-end border-b border-border px-2">
        <Button
          variant="ghost"
          size="icon"
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          aria-expanded={!collapsed}
          onClick={onToggle}
        >
          {collapsed ? <ChevronsRight size={18} /> : <ChevronsLeft size={18} />}
        </Button>
      </div>

      <ScrollArea className="flex-1">
        <div className="flex flex-col gap-1 p-2">
          {PLATFORM_NAV_ITEMS.map((item) => (
            <SidebarItem
              key={item.label}
              icon={item.icon}
              label={item.label}
              collapsed={collapsed}
              href={item.href}
            />
          ))}
        </div>
      </ScrollArea>
    </nav>
  );
}
