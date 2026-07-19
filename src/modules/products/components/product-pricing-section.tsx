"use client";

import type { Control } from "react-hook-form";

import { FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { ProductNumberField } from "@/modules/products/components/product-number-field";
import { ProductOptionSelector } from "@/modules/products/components/product-option-selector";
import type { CreateProductInput } from "@/modules/products/validation/product-schema";
import type { ProductMasterOption } from "@/types/product";

interface ProductPricingSectionProps {
  control: Control<CreateProductInput>;
  marginProfiles: ProductMasterOption[];
}

/** Pricing: reference prices stored as plain data — every derived price is
 * the Pricing Engine's (#28) job (architecture-context.md Invariant 6). The
 * Margin Profile picker only assigns a reference; no price is calculated or
 * previewed here (28-margin-profiles.md). */
export function ProductPricingSection({ control, marginProfiles }: ProductPricingSectionProps) {
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

      <FormField
        control={control}
        name="marginProfileId"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Margin Profile</FormLabel>
            <FormControl>
              <ProductOptionSelector
                options={marginProfiles.map((option) => ({
                  id: option.id,
                  label: option.name,
                  isActive: option.isActive,
                }))}
                value={field.value}
                onChange={field.onChange}
                noneLabel="No margin profile"
                emptyLabel="No margin profiles — create one under Masters → Margin Profiles"
              />
            </FormControl>
            <p className="text-xs text-muted-foreground">
              The Pricing Engine will apply this profile&apos;s percentages to the purchase price
              to derive tier-wise selling prices.
            </p>
            <FormMessage />
          </FormItem>
        )}
      />
    </section>
  );
}
