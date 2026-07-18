"use client";

import type { Control } from "react-hook-form";

import { ProductNumberField } from "@/modules/products/components/product-number-field";
import type { CreateProductInput } from "@/modules/products/validation/product-schema";

interface ProductPricingSectionProps {
  control: Control<CreateProductInput>;
}

/** Pricing: reference prices stored as plain data — every derived price is
 * the Pricing Engine's (#28) job (architecture-context.md Invariant 6). */
export function ProductPricingSection({ control }: ProductPricingSectionProps) {
  return (
    <section className="flex flex-col gap-4">
      <h2 className="text-sm font-semibold text-foreground">Pricing</h2>

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
        <ProductNumberField control={control} name="mrp" label="MRP" step="0.01" />
        <ProductNumberField
          control={control}
          name="sellingPrice"
          label="Selling Price"
          step="0.01"
        />
        <ProductNumberField
          control={control}
          name="purchasePrice"
          label="Purchase Price"
          step="0.01"
          helperText="Starting value for Latest Purchase Cost — later overwritten by each purchase."
        />
      </div>
    </section>
  );
}
