"use client";

import type { Control } from "react-hook-form";

import { Input } from "@/components/ui/input";
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import type { CreateCustomerInput } from "@/modules/customers/validation/customer-schema";

interface CustomerCreditSectionProps {
  control: Control<CreateCustomerInput>;
}

/** Credit Terms: plain stored data only — enforcement (blocking a sale
 * that would exceed the limit) is Sales Invoice (#36) / Voucher Engine
 * (#29) territory (26-customer-management.md). */
export function CustomerCreditSection({ control }: CustomerCreditSectionProps) {
  return (
    <section className="flex flex-col gap-4">
      <h2 className="text-sm font-semibold text-foreground">Credit Terms</h2>

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
        <FormField
          control={control}
          name="creditLimit"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Credit Limit</FormLabel>
              <FormControl>
                <Input
                  type="number"
                  min={0}
                  step="0.01"
                  {...field}
                  value={field.value ?? ""}
                  onChange={(event) => {
                    const value = event.target.valueAsNumber;
                    field.onChange(Number.isNaN(value) ? undefined : value);
                  }}
                />
              </FormControl>
              <p className="text-xs text-muted-foreground">
                Stored for future billing — nothing enforces it yet.
              </p>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={control}
          name="creditDays"
          render={({ field }) => (
            <FormItem>
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
              <p className="text-xs text-muted-foreground">Payment terms in days (0–365).</p>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>
    </section>
  );
}
