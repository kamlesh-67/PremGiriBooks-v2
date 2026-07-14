"use client";

import * as React from "react";
import type { ReactNode } from "react";

import { TopNavbar } from "@/components/layout/top-navbar";
import { PlatformSidebar } from "@/components/layout/platform-sidebar";
import { Content } from "@/components/layout/content";
import { StatusBar } from "@/components/layout/status-bar";
import { BreadcrumbBar } from "@/components/layout/breadcrumb-bar";

interface PlatformShellProps {
  children: ReactNode;
}

// A separate shell from AppShell/Sidebar (not a `mode` prop on them) — a
// Super Admin has no "current company" and the Platform nav is
// structurally different from the ERP nav, per Permanent Architecture
// Principle 8 (Platform/ERP modules stay completely separated). TopNavbar/
// BreadcrumbBar/Content/StatusBar are generic chrome, reused unchanged.
export function PlatformShell({ children }: PlatformShellProps) {
  const [collapsed, setCollapsed] = React.useState(false);

  return (
    <div className="flex h-screen w-full flex-col overflow-hidden bg-background text-foreground">
      <TopNavbar />
      <BreadcrumbBar />
      <div className="flex flex-1 overflow-hidden">
        <PlatformSidebar collapsed={collapsed} onToggle={() => setCollapsed((prev) => !prev)} />
        <Content>{children}</Content>
      </div>
      <StatusBar />
    </div>
  );
}
