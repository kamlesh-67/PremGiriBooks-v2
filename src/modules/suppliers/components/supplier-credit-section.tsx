"use client";

import type { Control } from "react-hook-form";

import { Input } from "@/components/ui/input";
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import type { CreateSupplierInput } from "@/modules/suppliers/validation/supplier-schema";

interface SupplierCreditSectionProps {
  control: Control<CreateSupplierInput>;
}

/** Credit Terms: creditDays only — no creditLimit field. A credit limit is a
 * cap WE impose on a debtor; what a supplier extends to us is their
 * decision, not something this system enforces (27-supplier-management.md's
 * Data Model). Purchase Invoice (#42) / payables ageing will consume
 * creditDays. */
export function SupplierCreditSection({ control }: SupplierCreditSectionProps) {
  return (
    <section className="flex flex-col gap-4">
      <h2 className="text-sm font-semibold text-foreground">Credit Terms</h2>

      <FormField
        control={control}
        name="creditDays"
        render={({ field }) => (
          <FormItem className="max-w-xs">
            <FormLabel>Credit Days</FormLabel>
            <FormControl>
              <Input
                type="number"
                min={0}
                max={365}
                step={1}
                {...field}
                value={field.value ?? ""}
                onChange={(event) => {
                  const value = event.target.valueAsNumber;
                  field.onChange(Number.isNaN(value) ? undefined : value);
                }}
              />
            </FormControl>
            <p className="text-xs text-muted-foreground">
              Agreed payment terms in days (0–365).
            </p>
            <FormMessage />
          </FormItem>
        )}
      />
    </section>
  );
}
