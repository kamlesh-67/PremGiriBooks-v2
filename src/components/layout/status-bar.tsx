"use client";

import { useTheme } from "next-themes";

import { Separator } from "@/components/ui/separator";
import { useMounted } from "@/hooks/use-mounted";
import { useCompany } from "@/components/providers/company-provider";
import { useFinancialYear } from "@/components/providers/financial-year-provider";

interface StatusFieldProps {
  label: string;
  value: string;
}

function StatusField({ label, value }: StatusFieldProps) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium text-foreground">{value}</span>
    </div>
  );
}

export function StatusBar() {
  const { theme } = useTheme();
  const mounted = useMounted();
  const { company } = useCompany();
  const { financialYear } = useFinancialYear();

  return (
    <footer className="flex h-8 shrink-0 items-center gap-3 border-t border-border bg-navbar px-4 text-xs">
      <StatusField label="Company" value={company?.displayName ?? company?.companyName ?? "—"} />
      <Separator orientation="vertical" className="h-4" />
      <StatusField label="FY" value={financialYear?.name ?? "—"} />
      <Separator orientation="vertical" className="h-4" />
      <StatusField label="Branch" value="—" />
      <Separator orientation="vertical" className="h-4" />
      <StatusField label="Database" value="Local" />
      <Separator orientation="vertical" className="h-4" />
      <StatusField label="Theme" value={mounted ? (theme ?? "system") : "—"} />
    </footer>
  );
}
