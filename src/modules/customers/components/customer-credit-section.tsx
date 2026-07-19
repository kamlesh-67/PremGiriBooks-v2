"use client";

import type { Control } from "react-hook-form";

import { Input } from "@/components/ui/input";
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
// Cross-module reuse of the Product form's generic picker — already
// precedented by price-list-add-item-form.tsx importing it from `products`
// despite living in `price-lists` (30-pricing-engine.md).
import { ProductOptionSelector } from "@/modules/products/components/product-option-selector";
import type { CreateCustomerInput } from "@/modules/customers/validation/customer-schema";
import type { PriceListMasterOption } from "@/types/price-list";

interface CustomerCreditSectionProps {
  control: Control<CreateCustomerInput>;
  /** Active price lists (plus, on edit, the customer's current assignment
   * even if since deactivated) — the Pricing Engine's `Customer.priceListId`
   * hook (30-pricing-engine.md). */
  priceLists: PriceListMasterOption[];
}

/** Credit Terms: plain stored data only — enforcement (blocking a sale
 * that would exceed the limit) is Sales Invoice (#36) / Voucher Engine
 * (#29) territory (26-customer-management.md). The Price List picker only
 * assigns a reference; resolving it into a price is the Pricing Engine's
 * job (architecture-context.md Invariant 6). */
export function CustomerCreditSection({ control, priceLists }: CustomerCreditSectionProps) {
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

      <FormField
        control={control}
        name="priceListId"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Price List</FormLabel>
            <FormControl>
              <ProductOptionSelector
                options={priceLists.map((option) => ({
                  id: option.id,
                  label: option.name,
                  isActive: option.isActive,
                }))}
                value={field.value}
                onChange={field.onChange}
                noneLabel="No price list"
                emptyLabel="No price lists — create one under Masters → Price Lists"
              />
            </FormControl>
            <p className="text-xs text-muted-foreground">
              An assigned price list wins over any tier-matching list at billing time (the
              Pricing Engine&apos;s resolution order).
            </p>
            <FormMessage />
          </FormItem>
        )}
      />
    </section>
  );
}
