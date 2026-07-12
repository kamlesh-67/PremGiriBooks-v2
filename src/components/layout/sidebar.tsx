"use client";

import {
  LayoutDashboard,
  Boxes,
  ShoppingCart,
  Truck,
  Package,
  Calculator,
  Receipt,
  BarChart3,
  Users,
  Settings,
  ChevronsLeft,
  ChevronsRight,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { SidebarItem } from "@/components/layout/sidebar-item";

const NAV_ITEMS = [
  { icon: LayoutDashboard, label: "Dashboard", href: "/" },
  { icon: Boxes, label: "Masters", href: "/masters", adminOnly: true },
  { icon: ShoppingCart, label: "Sales" },
  { icon: Truck, label: "Purchase" },
  { icon: Package, label: "Inventory" },
  { icon: Calculator, label: "Accounting" },
  { icon: Receipt, label: "GST" },
  { icon: BarChart3, label: "Reports" },
  { icon: Users, label: "Employees" },
  { icon: Settings, label: "Settings", href: "/settings/users", adminOnly: true },
] as const;

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
  isAdmin: boolean;
}

export function Sidebar({ collapsed, onToggle, isAdmin }: SidebarProps) {
  const visibleItems = NAV_ITEMS.filter((item) => !("adminOnly" in item && item.adminOnly) || isAdmin);

  return (
    <nav
      aria-label="Primary"
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
          {visibleItems.map((item) => (
            <SidebarItem
              key={item.label}
              icon={item.icon}
              label={item.label}
              collapsed={collapsed}
              href={"href" in item ? item.href : undefined}
            />
          ))}
        </div>
      </ScrollArea>
    </nav>
  );
}
