import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

interface ContentProps {
  children: ReactNode;
  className?: string;
}

export function Content({ children, className }: ContentProps) {
  return (
    <main className={cn("flex-1 overflow-y-auto bg-background", className)}>
      {children}
    </main>
  );
}
