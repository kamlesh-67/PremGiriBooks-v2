"use client";

import type { Control } from "react-hook-form";

import { FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { ProductNumberField } from "@/modules/products/components/product-number-field";
import { ProductOptionSelector } from "@/modules/products/components/product-option-selector";
import type { CreateProductInput } from "@/modules/products/validation/product-schema";
import type { ProductMasterOption } from "@/types/product";

interface ProductStockSectionProps {
  control: Control<CreateProductInput>;
  warehouses: ProductMasterOption[];
  /** The selected unit's decimalPlaces (0 when none picked yet) — drives the
   * input step and the helper text; the server re-verifies the precision. */
  unitDecimalPlaces: number;
}

/** Stock: reorder threshold + default warehouse — no quantities here, every
 * movement is the Inventory Engine's (#30) job (Invariant 7). */
export function ProductStockSection({
  control,
  warehouses,
  unitDecimalPlaces,
}: ProductStockSectionProps) {
  const step = unitDecimalPlaces === 0 ? "1" : `0.${"0".repeat(unitDecimalPlaces - 1)}1`;

  return (
    <section className="flex flex-col gap-4">
      <h2 className="text-sm font-semibold text-foreground">Stock</h2>

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
        <ProductNumberField
          control={control}
          name="minStockLevel"
          label="Min Stock Level"
          step={step}
          helperText={
            unitDecimalPlaces === 0
              ? "Reorder threshold — a whole number (the selected unit has 0 decimal places)."
              : `Reorder threshold — up to ${unitDecimalPlaces} decimal places (the selected unit's limit).`
          }
        />

        <FormField
          control={control}
          name="defaultWarehouseId"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Default Warehouse</FormLabel>
              <FormControl>
                <ProductOptionSelector
                  options={warehouses.map((option) => ({
                    id: option.id,
                    label: option.name,
                    isActive: option.isActive,
                  }))}
                  value={field.value}
                  onChange={field.onChange}
                  noneLabel="No default warehouse"
                  emptyLabel="No warehouses"
                />
              </FormControl>
              <p className="text-xs text-muted-foreground">
                Optional — single-location shops may never create a warehouse.
              </p>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>
    </section>
  );
}
