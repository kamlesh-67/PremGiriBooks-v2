import type { ProductOptionItem } from "@/modules/products/components/product-option-selector";
import type { PriceListItemWithProduct } from "@/types/price-list";
import type { ProductWithRelations } from "@/types/product";

/**
 * Active products (the picker's normal contents) plus, for each existing
 * item row, its product merged in even if since deactivated — so a stored
 * row's product stays visible and re-selectable (labeled "(Inactive)" by
 * ProductOptionSelector), mirroring product-form-options.ts's withCurrent,
 * scaled to multiple item rows instead of a single reference
 * (29-price-lists.md's UI).
 */
export function buildPriceListProductOptions(
  activeProducts: ProductWithRelations[],
  items: PriceListItemWithProduct[]
): ProductOptionItem[] {
  const options: ProductOptionItem[] = activeProducts.map((product) => ({
    id: product.id,
    label: `${product.name} (${product.productCode})`,
    isActive: product.isActive,
  }));

  const seen = new Set(options.map((option) => option.id));
  for (const item of items) {
    if (seen.has(item.product.id)) {
      continue;
    }
    seen.add(item.product.id);
    options.push({
      id: item.product.id,
      label: `${item.product.name} (${item.product.productCode})`,
      isActive: item.product.isActive,
    });
  }

  return options;
}
