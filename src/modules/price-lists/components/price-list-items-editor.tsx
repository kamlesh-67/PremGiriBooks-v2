import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { ProductOptionItem } from "@/modules/products/components/product-option-selector";
import { PriceListAddItemForm } from "@/modules/price-lists/components/price-list-add-item-form";
import { PriceListItemRow } from "@/modules/price-lists/components/price-list-item-row";
import type { PriceListItemWithProduct } from "@/types/price-list";

interface PriceListItemsEditorProps {
  priceListId: string;
  items: PriceListItemWithProduct[];
  products: ProductOptionItem[];
  canEdit: boolean;
}

/**
 * This codebase's first parent-child editor (29-price-lists.md's UI) — a
 * table of item rows, each with its own inline edit/remove Server Actions,
 * plus an add-row form. No whole-list batch save, matching the per-row
 * action envelope convention.
 */
export function PriceListItemsEditor({
  priceListId,
  items,
  products,
  canEdit,
}: PriceListItemsEditorProps) {
  return (
    <div className="flex flex-col gap-4">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Product</TableHead>
            <TableHead className="text-right">Min Qty</TableHead>
            <TableHead className="text-right">Price</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.length === 0 ? (
            <TableRow>
              <TableCell colSpan={4} className="py-10 text-center text-sm text-muted-foreground">
                No item rows yet — add one below.
              </TableCell>
            </TableRow>
          ) : (
            items.map((item) => (
              <PriceListItemRow
                key={item.id}
                priceListId={priceListId}
                item={item}
                products={products}
                canEdit={canEdit}
              />
            ))
          )}
        </TableBody>
      </Table>

      {canEdit ? <PriceListAddItemForm priceListId={priceListId} products={products} /> : null}
    </div>
  );
}
