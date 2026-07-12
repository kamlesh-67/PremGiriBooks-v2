"use client";

import * as React from "react";
import Link from "next/link";
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
  activateCompanyAction,
  deactivateCompanyAction,
} from "@/modules/company/actions/company-actions";
import { CompanyStatusBadge } from "@/modules/company/components/company-status-badge";
import type { CompanyWithSettings } from "@/types/company";

interface CompanyTableProps {
  companies: CompanyWithSettings[];
}

export function CompanyTable({ companies }: CompanyTableProps) {
  const [pendingId, setPendingId] = React.useState<string | null>(null);

  async function handleToggleActive(company: CompanyWithSettings) {
    setPendingId(company.id);
    const action = company.isActive ? deactivateCompanyAction : activateCompanyAction;
    const result = await action(company.id);
    setPendingId(null);

    if (!result.success) {
      toast.error(result.error ?? "Failed to update company status.");
      return;
    }

    toast.success(company.isActive ? "Company deactivated." : "Company activated.");
  }

  if (companies.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-border py-16 text-center">
        <p className="text-sm text-muted-foreground">No companies found.</p>
        <Button
          size="sm"
          nativeButton={false}
          render={<Link href="/company/new">Create Company</Link>}
        />
      </div>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Company Name</TableHead>
          <TableHead>GSTIN</TableHead>
          <TableHead>Mobile Number</TableHead>
          <TableHead>Status</TableHead>
          <TableHead className="text-right">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {companies.map((company) => (
          <TableRow key={company.id}>
            <TableCell>
              <div className="flex flex-col">
                <span className="font-medium text-foreground">
                  {company.displayName ?? company.companyName}
                </span>
                <span className="text-xs text-muted-foreground">{company.legalName}</span>
              </div>
            </TableCell>
            <TableCell>{company.gstin ?? "—"}</TableCell>
            <TableCell className="font-financial">{company.mobileNumber ?? "—"}</TableCell>
            <TableCell>
              <CompanyStatusBadge isActive={company.isActive} />
            </TableCell>
            <TableCell className="text-right">
              <div className="flex justify-end gap-2">
                <Button
                  variant="ghost"
                  size="icon-sm"
                  nativeButton={false}
                  render={
                    <Link href={`/company/${company.id}/edit`} aria-label="Edit company">
                      <Pencil size={16} />
                    </Link>
                  }
                />

                <Button
                  variant="outline"
                  size="sm"
                  disabled={pendingId === company.id}
                  onClick={() => handleToggleActive(company)}
                >
                  {company.isActive ? "Deactivate" : "Activate"}
                </Button>
              </div>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
