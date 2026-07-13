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
} from "@/modules/administration/actions/company-admin-actions";
import { CompanyStatusBadge } from "@/modules/company/components/company-status-badge";
import type { CompanyWithSettings } from "@/types/company";

interface CompanyTableProps {
  companies: CompanyWithSettings[];
  // Activate/Deactivate (and the empty-state "Create Company" CTA) call
  // companyService.activateCompany/deactivateCompany, which assert
  // getCurrentSuperAdmin() — genuinely Super-Admin-only Platform
  // operations, so false by default.
  canManageStatus?: boolean;
  // Editing is NOT Super-Admin-only: /company/[id]/edit is the Company
  // Admin's own operational-settings screen (theme/date format/currency/
  // logo), separate from Super Admin's legal/business info screen at
  // /administration/companies/[id]/edit. Callers pass their own
  // editBasePath so this one prop works for both routes.
  canEdit?: boolean;
  editBasePath?: string;
}

export function CompanyTable({
  companies,
  canManageStatus = false,
  canEdit = false,
  editBasePath = "/administration/companies",
}: CompanyTableProps) {
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
        {canManageStatus && (
          <Button
            size="sm"
            nativeButton={false}
            render={<Link href="/administration/companies/new">Create Company</Link>}
          />
        )}
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
          {(canEdit || canManageStatus) && (
            <TableHead className="text-right">Actions</TableHead>
          )}
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
            {(canEdit || canManageStatus) && (
              <TableCell className="text-right">
                <div className="flex justify-end gap-2">
                  {canEdit && (
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      nativeButton={false}
                      render={
                        <Link
                          href={`${editBasePath}/${company.id}/edit`}
                          aria-label="Edit company"
                        >
                          <Pencil size={16} />
                        </Link>
                      }
                    />
                  )}

                  {canManageStatus && (
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={pendingId === company.id}
                      onClick={() => handleToggleActive(company)}
                    >
                      {company.isActive ? "Deactivate" : "Activate"}
                    </Button>
                  )}
                </div>
              </TableCell>
            )}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
