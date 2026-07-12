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
  activateUserAction,
  deactivateUserAction,
} from "@/modules/users/actions/user-actions";
import { UserStatusBadge } from "@/modules/users/components/user-status-badge";
import type { UserWithRole } from "@/types/user";

interface UserTableProps {
  users: UserWithRole[];
  currentUserId: string;
}

export function UserTable({ users, currentUserId }: UserTableProps) {
  const [pendingId, setPendingId] = React.useState<string | null>(null);

  async function handleToggleActive(user: UserWithRole) {
    setPendingId(user.id);
    try {
      const action = user.isActive ? deactivateUserAction : activateUserAction;
      const result = await action(user.id);

      if (!result.success) {
        toast.error(result.error ?? "Failed to update user status.");
        return;
      }

      toast.success(user.isActive ? "User deactivated." : "User activated.");
    } catch {
      toast.error("Failed to update user status. Please try again.");
    } finally {
      setPendingId(null);
    }
  }

  if (users.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-border py-16 text-center">
        <p className="text-sm text-muted-foreground">No users found.</p>
        <Button
          size="sm"
          nativeButton={false}
          render={<Link href="/settings/users/new">Create User</Link>}
        />
      </div>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Name</TableHead>
          <TableHead>Email</TableHead>
          <TableHead>Role</TableHead>
          <TableHead>Status</TableHead>
          <TableHead className="text-right">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {users.map((user) => (
          <TableRow key={user.id}>
            <TableCell>
              <div className="flex flex-col">
                <span className="font-medium text-foreground">{user.fullName}</span>
                <span className="text-xs text-muted-foreground">{user.username}</span>
              </div>
            </TableCell>
            <TableCell>{user.email}</TableCell>
            <TableCell>{user.role.name}</TableCell>
            <TableCell>
              <UserStatusBadge isActive={user.isActive} />
            </TableCell>
            <TableCell className="text-right">
              <div className="flex justify-end gap-2">
                <Button
                  variant="ghost"
                  size="icon-sm"
                  nativeButton={false}
                  render={
                    <Link href={`/settings/users/${user.id}/edit`} aria-label="Edit user">
                      <Pencil size={16} />
                    </Link>
                  }
                />

                <Button
                  variant="outline"
                  size="sm"
                  disabled={
                    pendingId === user.id || (user.isActive && user.id === currentUserId)
                  }
                  onClick={() => handleToggleActive(user)}
                >
                  {user.isActive ? "Deactivate" : "Activate"}
                </Button>
              </div>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
