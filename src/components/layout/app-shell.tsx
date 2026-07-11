"use client";

import * as React from "react";
import type { ReactNode } from "react";

import { TopNavbar } from "@/components/layout/top-navbar";
import { Sidebar } from "@/components/layout/sidebar";
import { Content } from "@/components/layout/content";
import { StatusBar } from "@/components/layout/status-bar";

interface AppShellProps {
  children: ReactNode;
}

export function AppShell({ children }: AppShellProps) {
  const [collapsed, setCollapsed] = React.useState(false);

  return (
    <div className="flex h-screen w-full flex-col overflow-hidden bg-background text-foreground">
      <TopNavbar />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar
          collapsed={collapsed}
          onToggle={() => setCollapsed((prev) => !prev)}
        />
        <Content>{children}</Content>
      </div>
      <StatusBar />
    </div>
  );
}
