"use client";

import { CalendarRange } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FinancialYearStatusBadge } from "@/modules/financial-year/components/financial-year-status-badge";
import { formatFinancialYearDate } from "@/modules/financial-year/utils/format-financial-year-date";
import type { FinancialYear } from "@/types/financial-year";

interface FinancialYearCardProps {
  financialYear: FinancialYear;
  onSelect: () => void;
  isSelecting?: boolean;
}

export function FinancialYearCard({ financialYear, onSelect, isSelecting }: FinancialYearCardProps) {
  return (
    <button
      type="button"
      onClick={onSelect}
      disabled={isSelecting}
      className="w-full text-left outline-none disabled:opacity-60"
    >
      <Card className="transition-colors hover:bg-muted/40 focus-visible:ring-2 focus-visible:ring-ring">
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-dashed border-border text-muted-foreground">
              <CalendarRange size={20} />
            </div>
            <CardTitle>{financialYear.name}</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="flex items-center justify-between text-xs text-muted-foreground">
          <span>
            {formatFinancialYearDate(financialYear.startDate)} –{" "}
            {formatFinancialYearDate(financialYear.endDate)}
          </span>
          <FinancialYearStatusBadge
            isCurrent={financialYear.isCurrent}
            isClosed={financialYear.isClosed}
          />
        </CardContent>
      </Card>
    </button>
  );
}
