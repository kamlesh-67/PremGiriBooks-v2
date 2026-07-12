"use client";

import * as React from "react";
import { toast } from "sonner";

import { FinancialYearCard } from "@/modules/financial-year/components/financial-year-card";
import { selectFinancialYearAction } from "@/modules/financial-year/actions/financial-year-actions";
import type { FinancialYear } from "@/types/financial-year";

interface FinancialYearSelectorProps {
  financialYears: FinancialYear[];
}

export function FinancialYearSelector({ financialYears }: FinancialYearSelectorProps) {
  const [pendingId, setPendingId] = React.useState<string | null>(null);
  const hasAutoSelected = React.useRef(false);

  const handleSelect = React.useCallback(async (financialYearId: string) => {
    setPendingId(financialYearId);
    const result = await selectFinancialYearAction(financialYearId);
    if (result && !result.success) {
      toast.error(result.error ?? "Failed to select financial year.");
    }
    setPendingId(null);
  }, []);

  React.useEffect(() => {
    const autoSelectId =
      financialYears.length === 1
        ? financialYears[0].id
        : financialYears.find((financialYear) => financialYear.isCurrent)?.id;

    if (autoSelectId && !hasAutoSelected.current) {
      hasAutoSelected.current = true;
      void handleSelect(autoSelectId);
    }
  }, [financialYears, handleSelect]);

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {financialYears.map((financialYear) => (
        <FinancialYearCard
          key={financialYear.id}
          financialYear={financialYear}
          onSelect={() => handleSelect(financialYear.id)}
          isSelecting={pendingId === financialYear.id}
        />
      ))}
    </div>
  );
}
