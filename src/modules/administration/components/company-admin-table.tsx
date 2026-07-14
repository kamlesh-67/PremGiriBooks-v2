"use client";

import * as React from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  saveCompanyAdminAction,
  setCompanyAdminActiveAction,
} from "@/modules/administration/actions/platform-user-actions";
import type { CompanyAdminSummary } from "@/types/user";

interface CompanyAdminTableProps {
  companyAdmins: CompanyAdminSummary[];
  companies: { id: string; companyName: string }[];
}

interface ProfileDraft {
  username: string;
  fullName: string;
  email: string;
  mobile: string;
  companyId: string;
}

function toProfileDraft(admin: CompanyAdminSummary): ProfileDraft {
  return {
    username: admin.username,
    fullName: admin.fullName,
    email: admin.email,
    mobile: admin.mobile ?? "",
    companyId: admin.companyId,
  };
}

export function CompanyAdminTable({ companyAdmins, companies }: CompanyAdminTableProps) {
  const [pendingId, setPendingId] = React.useState<string | null>(null);
  const [resetTargetId, setResetTargetId] = React.useState<string | null>(null);
  const [newPassword, setNewPassword] = React.useState("");
  const [editTargetId, setEditTargetId] = React.useState<string | null>(null);
  const [profileDraft, setProfileDraft] = React.useState<ProfileDraft | null>(null);

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

  function toggleResetTarget(admin: CompanyAdminSummary) {
    setResetTargetId((current) => (current === admin.id ? null : admin.id));
    setNewPassword("");
    setEditTargetId(null);
    setProfileDraft(null);
  }

  function toggleEditTarget(admin: CompanyAdminSummary) {
    const next = editTargetId === admin.id ? null : admin.id;
    setEditTargetId(next);
    setProfileDraft(next ? toProfileDraft(admin) : null);
    setResetTargetId(null);
    setNewPassword("");
  }

  async function handleSaveProfile(admin: CompanyAdminSummary) {
    if (!profileDraft) {
      return;
    }
    setPendingId(admin.id);

    // One call, one transaction — the profile fields and the (optional)
    // company reassignment either both apply or both roll back together.
    const result = await saveCompanyAdminAction(admin.id, {
      username: profileDraft.username,
      fullName: profileDraft.fullName,
      email: profileDraft.email,
      mobile: profileDraft.mobile ? profileDraft.mobile : undefined,
      companyId: profileDraft.companyId,
    });
    setPendingId(null);
    if (!result.success) {
      toast.error(result.error ?? "Failed to save Company Admin.");
      return;
    }

    toast.success(`${profileDraft.fullName} saved.`);
    setEditTargetId(null);
    setProfileDraft(null);
  }

  function companyOptionsFor(admin: CompanyAdminSummary) {
    if (companies.some((company) => company.id === admin.companyId)) {
      return companies;
    }
    // The admin's current company was filtered out of `companies` (e.g. it's
    // inactive) — still show it as the selected option instead of an empty
    // dropdown, without adding it as a real reassignment target elsewhere.
    return [{ id: admin.companyId, companyName: admin.companyName }, ...companies];
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
                    onClick={() => toggleEditTarget(admin)}
                  >
                    Edit
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={pendingId === admin.id}
                    onClick={() => toggleResetTarget(admin)}
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
            {editTargetId === admin.id && profileDraft && (
              <TableRow>
                <TableCell colSpan={5}>
                  <div className="grid grid-cols-1 gap-2 py-2 sm:grid-cols-5">
                    <Input
                      aria-label="Username"
                      placeholder="Username"
                      value={profileDraft.username}
                      onChange={(event) =>
                        setProfileDraft((current) =>
                          current ? { ...current, username: event.target.value } : current
                        )
                      }
                    />
                    <Input
                      aria-label="Full name"
                      placeholder="Full name"
                      value={profileDraft.fullName}
                      onChange={(event) =>
                        setProfileDraft((current) =>
                          current ? { ...current, fullName: event.target.value } : current
                        )
                      }
                    />
                    <Input
                      aria-label="Email"
                      type="email"
                      placeholder="Email"
                      value={profileDraft.email}
                      onChange={(event) =>
                        setProfileDraft((current) =>
                          current ? { ...current, email: event.target.value } : current
                        )
                      }
                    />
                    <Input
                      aria-label="Mobile"
                      placeholder="Mobile"
                      value={profileDraft.mobile}
                      onChange={(event) =>
                        setProfileDraft((current) =>
                          current ? { ...current, mobile: event.target.value } : current
                        )
                      }
                    />
                    <Select
                      // `items` lets <SelectValue> resolve the trigger's
                      // label (company name) up front — without it, Base UI
                      // only knows an option's label once its <SelectItem>
                      // has actually mounted (i.e. after the popup has been
                      // opened at least once), so the trigger would show the
                      // raw companyId until then.
                      items={Object.fromEntries(
                        companyOptionsFor(admin).map((company) => [company.id, company.companyName])
                      )}
                      value={profileDraft.companyId}
                      onValueChange={(companyId) => {
                        if (!companyId) {
                          return;
                        }
                        setProfileDraft((current) => (current ? { ...current, companyId } : current));
                      }}
                    >
                      <SelectTrigger aria-label="Company" className="w-full">
                        <SelectValue placeholder="Company" />
                      </SelectTrigger>
                      <SelectContent>
                        {companyOptionsFor(admin).map((company) => (
                          <SelectItem key={company.id} value={company.id}>
                            {company.companyName}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex justify-end pb-2">
                    <Button
                      size="sm"
                      disabled={pendingId === admin.id}
                      onClick={() => handleSaveProfile(admin)}
                    >
                      Save
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            )}
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
