"use client";

import type { Control } from "react-hook-form";

import { Input } from "@/components/ui/input";
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import type { CreateCustomerInput } from "@/modules/customers/validation/customer-schema";

interface CustomerTaxSectionProps {
  control: Control<CreateCustomerInput>;
}

/** Tax Registration: GSTIN and PAN — optional (unregistered/consumer
 * customers are common), format-validated when present, deliberately not
 * unique (26-customer-management.md). */
export function CustomerTaxSection({ control }: CustomerTaxSectionProps) {
  return (
    <section className="flex flex-col gap-4">
      <h2 className="text-sm font-semibold text-foreground">Tax Registration</h2>

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
        <FormField
          control={control}
          name="gstin"
          render={({ field }) => (
            <FormItem>
              <FormLabel>GSTIN</FormLabel>
              <FormControl>
                <Input
                  className="uppercase"
                  maxLength={15}
                  placeholder="e.g. 27AAPFU0939F1ZV"
                  {...field}
                  value={field.value ?? ""}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={control}
          name="pan"
          render={({ field }) => (
            <FormItem>
              <FormLabel>PAN</FormLabel>
              <FormControl>
                <Input
                  className="uppercase"
                  maxLength={10}
                  placeholder="e.g. AAPFU0939F"
                  {...field}
                  value={field.value ?? ""}
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
