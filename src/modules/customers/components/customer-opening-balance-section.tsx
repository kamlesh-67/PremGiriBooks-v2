"use client";

import type { Control } from "react-hook-form";

import { Input } from "@/components/ui/input";
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { CreateCustomerInput } from "@/modules/customers/validation/customer-schema";

interface CustomerOpeningBalanceSectionProps {
  control: Control<CreateCustomerInput>;
}

/** Opening Balance: lives on the paired Ledger row. Defaults to Debit for a
 * debtor (a customer who owes us money); Credit remains selectable — an
 * advance received (26-customer-management.md). */
export function CustomerOpeningBalanceSection({ control }: CustomerOpeningBalanceSectionProps) {
  return (
    <section className="flex flex-col gap-4">
      <h2 className="text-sm font-semibold text-foreground">Opening Balance</h2>

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
        <FormField
          control={control}
          name="openingBalance"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Opening Balance</FormLabel>
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
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={control}
          name="openingBalanceType"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Opening Balance Type</FormLabel>
              <Select value={field.value} onValueChange={field.onChange}>
                <FormControl>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value="DEBIT">Debit</SelectItem>
                  <SelectItem value="CREDIT">Credit</SelectItem>
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>

      <FormField
        control={control}
        name="description"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Description</FormLabel>
            <FormControl>
              <Input {...field} value={field.value ?? ""} />
            </FormControl>
            <p className="text-xs text-muted-foreground">Stored on the customer&apos;s ledger.</p>
            <FormMessage />
          </FormItem>
        )}
      />
    </section>
  );
}
