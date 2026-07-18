"use client";

import { ProductForm } from "@/modules/products/components/product-form";
import type { ProductFormOptions } from "@/modules/products/utils/product-form-options";
import type { ProductWithRelations } from "@/types/product";

interface ProductEditFormProps {
  product: ProductWithRelations;
  options: ProductFormOptions;
}

/**
 * Edit wrapper around ProductForm — Create and Update share the same field
 * set (25-product-management.md), so this only makes the product prop
 * mandatory; it exists as the spec's named "Product Edit Form" seam for the
 * day edit diverges (once the Inventory Engine #30 makes unitId/productType
 * immutable for products with movements).
 */
export function ProductEditForm({ product, options }: ProductEditFormProps) {
  return <ProductForm product={product} options={options} />;
}
