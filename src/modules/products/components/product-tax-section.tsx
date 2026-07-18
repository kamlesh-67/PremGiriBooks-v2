"use client";

import type { Control } from "react-hook-form";

import { FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { ProductOptionSelector } from "@/modules/products/components/product-option-selector";
import type { CreateProductInput } from "@/modules/products/validation/product-schema";
import type { ProductHsnOption, ProductMasterOption } from "@/types/product";

interface ProductTaxSectionProps {
  control: Control<CreateProductInput>;
  /** Already filtered by the chosen product type — goods (Trading/Expense)
   * see HSN-type codes, services see SAC-type codes (the server re-verifies
   * the match). */
  hsnCodes: ProductHsnOption[];
  gstRates: ProductMasterOption[];
  isService: boolean;
}

/** Tax: which HSN/SAC code and GST rate slab apply — classification only,
 * all tax math is the GST Engine's (#31). */
export function ProductTaxSection({
  control,
  hsnCodes,
  gstRates,
  isService,
}: ProductTaxSectionProps) {
  const codeFamily = isService ? "SAC" : "HSN";

  return (
    <section className="flex flex-col gap-4">
      <h2 className="text-sm font-semibold text-foreground">Tax</h2>

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
        <FormField
          control={control}
          name="hsnCodeId"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{codeFamily} Code</FormLabel>
              <FormControl>
                <ProductOptionSelector
                  options={hsnCodes.map((hsnCode) => ({
                    id: hsnCode.id,
                    label: `${hsnCode.code} — ${hsnCode.description}`,
                    isActive: hsnCode.isActive,
                  }))}
                  value={field.value}
                  onChange={field.onChange}
                  noneLabel="No code"
                  emptyLabel={`No ${codeFamily} codes`}
                />
              </FormControl>
              <p className="text-xs text-muted-foreground">
                {isService
                  ? "Services use SAC codes."
                  : "Goods (Trading/Expense) use HSN codes."}
              </p>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={control}
          name="gstRateId"
          render={({ field }) => (
            <FormItem>
              <FormLabel>GST Rate</FormLabel>
              <FormControl>
                <ProductOptionSelector
                  options={gstRates.map((option) => ({
                    id: option.id,
                    label: option.name,
                    isActive: option.isActive,
                  }))}
                  value={field.value}
                  onChange={field.onChange}
                  noneLabel="No GST rate"
                  emptyLabel="No GST rates"
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>
    </section>
  );
}
