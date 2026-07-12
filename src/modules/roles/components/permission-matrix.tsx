"use client";

import * as React from "react";
import type { Permission } from "@prisma/client";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { PERMISSION_ACTIONS, PERMISSION_MODULES } from "@/constants/permissions";
import { setRolePermissionsAction } from "@/modules/roles/actions/permission-actions";

interface PermissionMatrixProps {
  roleId: string;
  catalog: Permission[];
  initialAssignedPermissionIds: string[];
}

function pairKey(module: string, action: string): string {
  return `${module}:${action}`;
}

export function PermissionMatrix({
  roleId,
  catalog,
  initialAssignedPermissionIds,
}: PermissionMatrixProps) {
  const catalogByPair = React.useMemo(() => {
    const map = new Map<string, Permission>();
    for (const permission of catalog) {
      map.set(pairKey(permission.module, permission.action), permission);
    }
    return map;
  }, [catalog]);

  const initialAssignedPairs = React.useMemo(() => {
    const assignedIds = new Set(initialAssignedPermissionIds);
    const pairs = new Set<string>();
    for (const permission of catalog) {
      if (assignedIds.has(permission.id)) {
        pairs.add(pairKey(permission.module, permission.action));
      }
    }
    return pairs;
  }, [catalog, initialAssignedPermissionIds]);

  const [assignedPairs, setAssignedPairs] = React.useState<Set<string>>(initialAssignedPairs);
  const [isSaving, setIsSaving] = React.useState(false);

  function toggle(module: string, action: string) {
    const key = pairKey(module, action);
    setAssignedPairs((previous) => {
      const next = new Set(previous);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  }

  const isDirty = React.useMemo(() => {
    if (assignedPairs.size !== initialAssignedPairs.size) {
      return true;
    }
    for (const key of assignedPairs) {
      if (!initialAssignedPairs.has(key)) {
        return true;
      }
    }
    return false;
  }, [assignedPairs, initialAssignedPairs]);

  async function handleSave() {
    setIsSaving(true);
    try {
      const pairs = Array.from(assignedPairs).map((key) => {
        const [module, action] = key.split(":");
        return { module, action };
      });

      const result = await setRolePermissionsAction(roleId, pairs);
      if (!result.success) {
        toast.error(result.error ?? "Failed to save permissions.");
        return;
      }

      toast.success("Permissions saved.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="overflow-x-auto rounded-2xl border border-border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Module</TableHead>
              {PERMISSION_ACTIONS.map((action) => (
                <TableHead key={action} className="text-center capitalize">
                  {action}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {PERMISSION_MODULES.map((moduleName) => (
              <TableRow key={moduleName}>
                <TableCell className="font-medium text-foreground capitalize">
                  {moduleName.replace("-", " ")}
                </TableCell>
                {PERMISSION_ACTIONS.map((action) => {
                  const key = pairKey(moduleName, action);
                  const existsInCatalog = catalogByPair.has(key);
                  return (
                    <TableCell key={action} className="text-center">
                      <Checkbox
                        checked={assignedPairs.has(key)}
                        disabled={isSaving || !existsInCatalog}
                        onCheckedChange={() => toggle(moduleName, action)}
                        aria-label={`${moduleName} ${action}`}
                      />
                    </TableCell>
                  );
                })}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={isSaving || !isDirty}>
          {isSaving ? "Saving…" : "Save Permissions"}
        </Button>
      </div>
    </div>
  );
}
