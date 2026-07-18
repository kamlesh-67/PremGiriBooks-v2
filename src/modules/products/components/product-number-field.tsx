"use client";

import type { Control } from "react-hook-form";

import { Input } from "@/components/ui/input";
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import type { CreateProductInput } from "@/modules/products/validation/product-schema";

interface ProductNumberFieldProps {
  control: Control<CreateProductInput>;
  name: "mrp" | "sellingPrice" | "purchasePrice" | "minStockLevel";
  label: string;
  step: string;
  helperText?: string;
}

/**
 * Shared optional-decimal input for the Pricing/Stock sections — one
 * component instead of four near-identical FormFields. Blank clears the
 * optional field instead of failing "must be a number" (valueAsNumber is NaN
 * for ""), the gst-rate-form.tsx convention.
 */
export function ProductNumberField({
  control,
  name,
  label,
  step,
  helperText,
}: ProductNumberFieldProps) {
  return (
    <FormField
      control={control}
      name={name}
      render={({ field }) => (
        <FormItem>
          <FormLabel>{label}</FormLabel>
          <FormControl>
            <Input
              type="number"
              min={0}
              step={step}
              {...field}
              value={field.value ?? ""}
              onChange={(event) =>
                field.onChange(
                  Number.isNaN(event.target.valueAsNumber)
                    ? undefined
                    : event.target.valueAsNumber
                )
              }
            />
          </FormControl>
          {helperText ? <p className="text-xs text-muted-foreground">{helperText}</p> : null}
          <FormMessage />
        </FormItem>
      )}
    />
  );
}
