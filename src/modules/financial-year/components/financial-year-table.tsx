"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Pencil } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  closeFinancialYearAction,
  setCurrentFinancialYearAction,
} from "@/modules/financial-year/actions/financial-year-actions";
import { FinancialYearStatusBadge } from "@/modules/financial-year/components/financial-year-status-badge";
import { formatFinancialYearDate } from "@/modules/financial-year/utils/format-financial-year-date";
import type { FinancialYear } from "@/types/financial-year";

interface FinancialYearTableProps {
  financialYears: FinancialYear[];
}

export function FinancialYearTable({ financialYears }: FinancialYearTableProps) {
  const router = useRouter();
  const [pendingId, setPendingId] = React.useState<string | null>(null);

  async function handleSetCurrent(financialYear: FinancialYear) {
    setPendingId(financialYear.id);
    const result = await setCurrentFinancialYearAction(financialYear.id);
    setPendingId(null);

    if (!result.success) {
      toast.error(result.error ?? "Failed to set current financial year.");
      return;
    }

    toast.success("Current financial year updated.");
  }

  async function handleClose(financialYear: FinancialYear) {
    setPendingId(financialYear.id);
    const result = await closeFinancialYearAction(financialYear.id);
    setPendingId(null);

    if (!result.success) {
      toast.error(result.error ?? "Failed to close financial year.");
      return;
    }

    toast.success("Financial year closed.");
    // The active-financial-year cookie may have just been cleared or
    // repointed — refresh so the Provider/Status Bar never keep showing the
    // now-closed year for the remainder of this session.
    router.refresh();
  }

  if (financialYears.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-border py-16 text-center">
        <p className="text-sm text-muted-foreground">No financial years found.</p>
        <Button
          size="sm"
          nativeButton={false}
          render={<Link href="/financial-year/new">Create Financial Year</Link>}
        />
      </div>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Name</TableHead>
          <TableHead>Start Date</TableHead>
          <TableHead>End Date</TableHead>
          <TableHead>Status</TableHead>
          <TableHead className="text-right">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {financialYears.map((financialYear) => (
          <TableRow key={financialYear.id}>
            <TableCell className="font-medium text-foreground">{financialYear.name}</TableCell>
            <TableCell className="font-financial">
              {formatFinancialYearDate(financialYear.startDate)}
            </TableCell>
            <TableCell className="font-financial">
              {formatFinancialYearDate(financialYear.endDate)}
            </TableCell>
            <TableCell>
              <FinancialYearStatusBadge
                isCurrent={financialYear.isCurrent}
                isClosed={financialYear.isClosed}
              />
            </TableCell>
            <TableCell className="text-right">
              <div className="flex justify-end gap-2">
                <Button
                  variant="ghost"
                  size="icon-sm"
                  disabled={financialYear.isClosed}
                  nativeButton={false}
                  render={
                    <Link
                      href={`/financial-year/${financialYear.id}/edit`}
                      aria-label="Edit financial year"
                    >
                      <Pencil size={16} />
                    </Link>
                  }
                />

                <Button
                  variant="outline"
                  size="sm"
                  disabled={
                    financialYear.isClosed ||
                    financialYear.isCurrent ||
                    pendingId === financialYear.id
                  }
                  onClick={() => handleSetCurrent(financialYear)}
                >
                  Set Current
                </Button>

                <Button
                  variant="outline"
                  size="sm"
                  disabled={financialYear.isClosed || pendingId === financialYear.id}
                  onClick={() => handleClose(financialYear)}
                >
                  Close
                </Button>
              </div>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
