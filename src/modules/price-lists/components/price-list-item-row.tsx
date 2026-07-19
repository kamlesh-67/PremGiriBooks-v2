"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { Pencil, Trash2 } from "lucide-react";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { TableCell, TableRow } from "@/components/ui/table";
import {
  ProductOptionSelector,
  type ProductOptionItem,
} from "@/modules/products/components/product-option-selector";
import {
  removePriceListItemAction,
  updatePriceListItemAction,
} from "@/modules/price-lists/actions/price-list-actions";
import {
  updatePriceListItemSchema,
  type UpdatePriceListItemInput,
} from "@/modules/price-lists/validation/price-list-schema";
import type { PriceListItemWithProduct } from "@/types/price-list";

interface PriceListItemRowProps {
  priceListId: string;
  item: PriceListItemWithProduct;
  products: ProductOptionItem[];
  canEdit: boolean;
}

function toNumberOrUndefined(value: number): number | undefined {
  return Number.isNaN(value) ? undefined : value;
}

function productLabel(item: PriceListItemWithProduct): string {
  const base = `${item.product.name} (${item.product.productCode})`;
  return item.product.isActive ? base : `${base} (Inactive)`;
}

/**
 * A single item row of the items editor (29-price-lists.md's UI), toggling
 * between a read view and an inline edit form — the row's own Server
 * Actions (update/remove), not a whole-list batch save.
 */
export function PriceListItemRow({ priceListId, item, products, canEdit }: PriceListItemRowProps) {
  const router = useRouter();
  const [isEditing, setIsEditing] = React.useState(false);
  const [isSaving, setIsSaving] = React.useState(false);
  const [isRemoving, setIsRemoving] = React.useState(false);

  const form = useForm<UpdatePriceListItemInput>({
    resolver: zodResolver(updatePriceListItemSchema),
    defaultValues: {
      productId: item.productId,
      sellingPrice: item.sellingPrice,
      minQuantity: item.minQuantity,
    },
  });

  async function handleSave(data: UpdatePriceListItemInput) {
    setIsSaving(true);
    try {
      const result = await updatePriceListItemAction(priceListId, item.id, data);
      if (result.success) {
        toast.success("Item row saved.");
        setIsEditing(false);
        router.refresh();
        return;
      }
      toast.error(result.error ?? "Failed to save item row.");
    } catch {
      toast.error("Failed to save item row.");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleRemove() {
    setIsRemoving(true);
    try {
      const result = await removePriceListItemAction(priceListId, item.id);
      if (result.success) {
        toast.success("Item row removed.");
        router.refresh();
        return;
      }
      toast.error(result.error ?? "Failed to remove item row.");
    } catch {
      toast.error("Failed to remove item row.");
    } finally {
      setIsRemoving(false);
    }
  }

  if (isEditing) {
    return (
      <TableRow>
        <TableCell colSpan={4}>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleSave)} className="flex flex-wrap items-end gap-3">
              <FormField
                control={form.control}
                name="productId"
                render={({ field }) => (
                  <FormItem className="min-w-56 flex-1">
                    <FormLabel>Product</FormLabel>
                    <FormControl>
                      <ProductOptionSelector
                        options={products}
                        value={field.value || undefined}
                        onChange={(value) => field.onChange(value ?? "")}
                        allowNone={false}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="minQuantity"
                render={({ field }) => (
                  <FormItem className="w-32">
                    <FormLabel>Min Qty</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min={0.0001}
                        step="0.0001"
                        {...field}
                        value={field.value ?? ""}
                        onChange={(event) =>
                          field.onChange(toNumberOrUndefined(event.target.valueAsNumber))
                        }
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="sellingPrice"
                render={({ field }) => (
                  <FormItem className="w-36">
                    <FormLabel>Price</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min={0}
                        step="0.01"
                        {...field}
                        onChange={(event) =>
                          field.onChange(toNumberOrUndefined(event.target.valueAsNumber))
                        }
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="mb-[2px] flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={isSaving}
                  onClick={() => {
                    form.reset({
                      productId: item.productId,
                      sellingPrice: item.sellingPrice,
                      minQuantity: item.minQuantity,
                    });
                    setIsEditing(false);
                  }}
                >
                  Cancel
                </Button>
                <Button type="submit" size="sm" disabled={isSaving}>
                  {isSaving ? "Saving…" : "Save"}
                </Button>
              </div>
            </form>
          </Form>
        </TableCell>
      </TableRow>
    );
  }

  return (
    <TableRow>
      <TableCell>{productLabel(item)}</TableCell>
      <TableCell className="text-right font-financial">{item.minQuantity}</TableCell>
      <TableCell className="text-right font-financial">{item.sellingPrice.toFixed(2)}</TableCell>
      <TableCell className="text-right">
        {canEdit ? (
          <div className="flex justify-end gap-2">
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="Edit item row"
              onClick={() => setIsEditing(true)}
            >
              <Pencil size={16} />
            </Button>
            <AlertDialog>
              <AlertDialogTrigger
                render={
                  <Button variant="ghost" size="icon-sm" aria-label="Remove item row">
                    <Trash2 size={16} />
                  </Button>
                }
              />
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Remove this item row?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This removes the {productLabel(item)} row at min quantity {item.minQuantity}.
                    This cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={handleRemove} disabled={isRemoving}>
                    {isRemoving ? "Removing…" : "Remove"}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        ) : null}
      </TableCell>
    </TableRow>
  );
}
