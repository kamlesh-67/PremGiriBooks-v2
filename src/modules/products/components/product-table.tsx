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
  activateProductAction,
  deactivateProductAction,
} from "@/modules/products/actions/product-actions";
import { ProductStatusBadge } from "@/modules/products/components/product-status-badge";
import { ProductTypeBadge } from "@/modules/products/components/product-type-badge";
import type { ProductWithRelations } from "@/types/product";

interface ProductTableProps {
  products: ProductWithRelations[];
  canEdit?: boolean;
  canManage?: boolean;
}

export function ProductTable({ products, canEdit = false, canManage = false }: ProductTableProps) {
  // Tracked per row (not a single pending id) so two rows toggled
  // concurrently each keep their own disabled state — the
  // hsn-code-table.tsx review-fix pattern (2026-07-15).
  const [pendingIds, setPendingIds] = React.useState<ReadonlySet<string>>(new Set());

  async function handleToggleActive(product: ProductWithRelations) {
    setPendingIds((prev) => new Set(prev).add(product.id));
    const action = product.isActive ? deactivateProductAction : activateProductAction;

    try {
      const result = await action(product.id);
      if (!result.success) {
        toast.error(result.error ?? "Failed to update product status.");
        return;
      }
      toast.success(product.isActive ? "Product deactivated." : "Product activated.");
    } catch {
      toast.error("Failed to update product status.");
    } finally {
      setPendingIds((prev) => {
        const next = new Set(prev);
        next.delete(product.id);
        return next;
      });
    }
  }

  if (products.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-border py-16 text-center">
        <p className="text-sm text-muted-foreground">No products found.</p>
      </div>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Name</TableHead>
          <TableHead>Code</TableHead>
          <TableHead>Type</TableHead>
          <TableHead>Category</TableHead>
          <TableHead>Brand</TableHead>
          <TableHead>Unit</TableHead>
          <TableHead className="text-right">Selling Price</TableHead>
          <TableHead>Status</TableHead>
          <TableHead className="text-right">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {products.map((product) => (
          <TableRow key={product.id}>
            <TableCell>
              <span className="font-medium text-foreground">{product.name}</span>
            </TableCell>
            <TableCell className="font-financial">{product.productCode}</TableCell>
            <TableCell>
              <ProductTypeBadge productType={product.productType} />
            </TableCell>
            <TableCell>
              {product.category ? (
                product.category.name
              ) : (
                <span className="text-muted-foreground">—</span>
              )}
            </TableCell>
            <TableCell>
              {product.brand ? product.brand.name : <span className="text-muted-foreground">—</span>}
            </TableCell>
            <TableCell>{product.unit.symbol}</TableCell>
            <TableCell className="text-right font-financial">
              {product.sellingPrice === null ? (
                <span className="text-muted-foreground">—</span>
              ) : (
                product.sellingPrice.toFixed(2)
              )}
            </TableCell>
            <TableCell>
              <ProductStatusBadge isActive={product.isActive} />
            </TableCell>
            <TableCell className="text-right">
              <div className="flex justify-end gap-2">
                {canEdit ? (
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    nativeButton={false}
                    render={
                      <Link href={`/masters/products/${product.id}/edit`} aria-label="Edit product">
                        <Pencil size={16} />
                      </Link>
                    }
                  />
                ) : null}
                {canManage ? (
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={pendingIds.has(product.id)}
                    onClick={() => handleToggleActive(product)}
                  >
                    {product.isActive ? "Deactivate" : "Activate"}
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
