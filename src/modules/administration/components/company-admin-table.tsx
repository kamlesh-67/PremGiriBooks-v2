"use client";

import * as React from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  resetCompanyAdminPasswordAction,
  setCompanyAdminActiveAction,
} from "@/modules/administration/actions/platform-user-actions";
import type { CompanyAdminSummary } from "@/types/user";

interface CompanyAdminTableProps {
  companyAdmins: CompanyAdminSummary[];
}

export function CompanyAdminTable({ companyAdmins }: CompanyAdminTableProps) {
  const [pendingId, setPendingId] = React.useState<string | null>(null);
  const [resetTargetId, setResetTargetId] = React.useState<string | null>(null);
  const [newPassword, setNewPassword] = React.useState("");

  async function handleToggleActive(admin: CompanyAdminSummary) {
    setPendingId(admin.id);
    const result = await setCompanyAdminActiveAction(admin.id, !admin.isActive);
    setPendingId(null);

    if (!result.success) {
      toast.error(result.error ?? "Failed to update status.");
      return;
    }
    toast.success(admin.isActive ? "Company Admin deactivated." : "Company Admin activated.");
  }

  async function handleResetPassword(admin: CompanyAdminSummary) {
    setPendingId(admin.id);
    const result = await resetCompanyAdminPasswordAction(admin.id, newPassword);
    setPendingId(null);

    if (!result.success) {
      toast.error(result.error ?? "Failed to reset password.");
      return;
    }
    toast.success(`Password reset for ${admin.username}.`);
    setResetTargetId(null);
    setNewPassword("");
  }

  if (companyAdmins.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-border py-16 text-center">
        <p className="text-sm text-muted-foreground">No Company Admins found.</p>
      </div>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Username</TableHead>
          <TableHead>Full Name</TableHead>
          <TableHead>Company</TableHead>
          <TableHead>Status</TableHead>
          <TableHead className="text-right">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {companyAdmins.map((admin) => (
          <React.Fragment key={admin.id}>
            <TableRow>
              <TableCell className="font-medium text-foreground">{admin.username}</TableCell>
              <TableCell>{admin.fullName}</TableCell>
              <TableCell>{admin.companyName}</TableCell>
              <TableCell>
                <Badge variant={admin.isActive ? "default" : "secondary"}>
                  {admin.isActive ? "Active" : "Inactive"}
                </Badge>
              </TableCell>
              <TableCell className="text-right">
                <div className="flex justify-end gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={pendingId === admin.id}
                    onClick={() =>
                      setResetTargetId((current) => (current === admin.id ? null : admin.id))
                    }
                  >
                    Reset Password
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={pendingId === admin.id}
                    onClick={() => handleToggleActive(admin)}
                  >
                    {admin.isActive ? "Deactivate" : "Activate"}
                  </Button>
                </div>
              </TableCell>
            </TableRow>
            {resetTargetId === admin.id && (
              <TableRow>
                <TableCell colSpan={5}>
                  <div className="flex items-center gap-2 py-2">
                    <Input
                      type="password"
                      placeholder="New password"
                      value={newPassword}
                      onChange={(event) => setNewPassword(event.target.value)}
                      className="max-w-xs"
                      autoComplete="new-password"
                    />
                    <Button
                      size="sm"
                      disabled={pendingId === admin.id || newPassword.length === 0}
                      onClick={() => handleResetPassword(admin)}
                    >
                      Confirm Reset
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            )}
          </React.Fragment>
        ))}
      </TableBody>
    </Table>
  );
}
