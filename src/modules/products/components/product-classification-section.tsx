"use client";

import type { Control } from "react-hook-form";

import { FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { ProductOptionSelector } from "@/modules/products/components/product-option-selector";
import type { CreateProductInput } from "@/modules/products/validation/product-schema";
import type { ProductMasterOption, ProductUnitOption } from "@/types/product";

interface ProductClassificationSectionProps {
  control: Control<CreateProductInput>;
  categories: ProductMasterOption[];
  brands: ProductMasterOption[];
  units: ProductUnitOption[];
}

/** Classification: category, brand, and the mandatory unit. */
export function ProductClassificationSection({
  control,
  categories,
  brands,
  units,
}: ProductClassificationSectionProps) {
  return (
    <section className="flex flex-col gap-4">
      <h2 className="text-sm font-semibold text-foreground">Classification</h2>

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
        <FormField
          control={control}
          name="categoryId"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Category</FormLabel>
              <FormControl>
                <ProductOptionSelector
                  options={categories.map((option) => ({
                    id: option.id,
                    label: option.name,
                    isActive: option.isActive,
                  }))}
                  value={field.value}
                  onChange={field.onChange}
                  noneLabel="No category"
                  emptyLabel="No categories"
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={control}
          name="brandId"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Brand</FormLabel>
              <FormControl>
                <ProductOptionSelector
                  options={brands.map((option) => ({
                    id: option.id,
                    label: option.name,
                    isActive: option.isActive,
                  }))}
                  value={field.value}
                  onChange={field.onChange}
                  noneLabel="No brand"
                  emptyLabel="No brands"
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>

      <FormField
        control={control}
        name="unitId"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Unit *</FormLabel>
            <FormControl>
              <ProductOptionSelector
                options={units.map((unit) => ({
                  id: unit.id,
                  label: `${unit.name} (${unit.symbol})`,
                  isActive: unit.isActive,
                }))}
                value={field.value || undefined}
                onChange={(unitId) => field.onChange(unitId ?? "")}
                allowNone={false}
                placeholder="Select a unit"
                emptyLabel="No units — create one under Masters → Units first"
              />
            </FormControl>
            <p className="text-xs text-muted-foreground">
              Required for every type — services too (billed in Hours/Nos/Jobs).
            </p>
            <FormMessage />
          </FormItem>
        )}
      />
    </section>
  );
}
