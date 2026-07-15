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
  activateBrandAction,
  deactivateBrandAction,
} from "@/modules/brands/actions/brand-actions";
import { BrandStatusBadge } from "@/modules/brands/components/brand-status-badge";
import type { Brand } from "@/types/brand";

interface BrandTableProps {
  brands: Brand[];
  canEdit?: boolean;
  canManage?: boolean;
}

export function BrandTable({ brands, canEdit = false, canManage = false }: BrandTableProps) {
  const [pendingId, setPendingId] = React.useState<string | null>(null);

  async function handleToggleActive(brand: Brand) {
    setPendingId(brand.id);
    const action = brand.isActive ? deactivateBrandAction : activateBrandAction;

    try {
      const result = await action(brand.id);
      if (!result.success) {
        toast.error(result.error ?? "Failed to update brand status.");
        return;
      }
      toast.success(brand.isActive ? "Brand deactivated." : "Brand activated.");
    } catch {
      toast.error("Failed to update brand status.");
    } finally {
      setPendingId(null);
    }
  }

  if (brands.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-border py-16 text-center">
        <p className="text-sm text-muted-foreground">No brands found.</p>
      </div>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Name</TableHead>
          <TableHead>Description</TableHead>
          <TableHead>Status</TableHead>
          <TableHead className="text-right">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {brands.map((brand) => (
          <TableRow key={brand.id}>
            <TableCell>
              <span className="font-medium text-foreground">{brand.name}</span>
            </TableCell>
            <TableCell>{brand.description ?? "—"}</TableCell>
            <TableCell>
              <BrandStatusBadge isActive={brand.isActive} />
            </TableCell>
            <TableCell className="text-right">
              <div className="flex justify-end gap-2">
                {canEdit ? (
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    nativeButton={false}
                    render={
                      <Link href={`/masters/brands/${brand.id}/edit`} aria-label="Edit brand">
                        <Pencil size={16} />
                      </Link>
                    }
                  />
                ) : null}
                {canManage ? (
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={pendingId === brand.id}
                    onClick={() => handleToggleActive(brand)}
                  >
                    {brand.isActive ? "Deactivate" : "Activate"}
                  </Button>
                ) : null}
              </div>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
