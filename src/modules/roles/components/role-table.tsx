"use client";

import * as React from "react";
import Link from "next/link";
import { Pencil } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { activateRoleAction, deactivateRoleAction } from "@/modules/roles/actions/role-actions";
import { RoleStatusBadge } from "@/modules/roles/components/role-status-badge";
import type { RoleWithPermissionCount } from "@/types/role";

interface RoleTableProps {
  roles: RoleWithPermissionCount[];
}

export function RoleTable({ roles }: RoleTableProps) {
  const [pendingId, setPendingId] = React.useState<string | null>(null);

  async function handleToggleActive(role: RoleWithPermissionCount) {
    setPendingId(role.id);
    try {
      const action = role.isActive ? deactivateRoleAction : activateRoleAction;
      const result = await action(role.id);

      if (!result.success) {
        toast.error(result.error ?? "Failed to update role status.");
        return;
      }

      toast.success(role.isActive ? "Role deactivated." : "Role activated.");
    } catch {
      toast.error("Failed to update role status. Please try again.");
    } finally {
      setPendingId(null);
    }
  }

  if (roles.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-border py-16 text-center">
        <p className="text-sm text-muted-foreground">No roles found.</p>
        <Button
          size="sm"
          nativeButton={false}
          render={<Link href="/settings/roles/new">Create Role</Link>}
        />
      </div>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Name</TableHead>
          <TableHead>Permissions</TableHead>
          <TableHead>Status</TableHead>
          <TableHead className="text-right">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {roles.map((role) => (
          <TableRow key={role.id}>
            <TableCell className="font-medium text-foreground">{role.name}</TableCell>
            <TableCell>{role._count.permissions}</TableCell>
            <TableCell>
              <RoleStatusBadge isActive={role.isActive} />
            </TableCell>
            <TableCell className="text-right">
              <div className="flex justify-end gap-2">
                <Button
                  variant="ghost"
                  size="icon-sm"
                  nativeButton={false}
                  render={
                    <Link href={`/settings/roles/${role.id}/edit`} aria-label="Edit role">
                      <Pencil size={16} />
                    </Link>
                  }
                />

                <Button
                  variant="outline"
                  size="sm"
                  disabled={pendingId === role.id}
                  onClick={() => handleToggleActive(role)}
                >
                  {role.isActive ? "Deactivate" : "Activate"}
                </Button>
              </div>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
