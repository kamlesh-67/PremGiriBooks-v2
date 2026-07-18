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
import { PRODUCT_TYPE_LABELS } from "@/modules/products/components/product-type-badge";
import { PRODUCT_TYPE_VALUES } from "@/modules/products/validation/product-schema";
import type { CreateProductInput } from "@/modules/products/validation/product-schema";

interface ProductIdentitySectionProps {
  control: Control<CreateProductInput>;
}

/** Identity: name, SKU, barcode, product type, description. */
export function ProductIdentitySection({ control }: ProductIdentitySectionProps) {
  return (
    <section className="flex flex-col gap-4">
      <h2 className="text-sm font-semibold text-foreground">Identity</h2>

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
        <FormField
          control={control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Name *</FormLabel>
              <FormControl>
                <Input {...field} placeholder="e.g. Premium Notebook A4" />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={control}
          name="productCode"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Product Code *</FormLabel>
              <FormControl>
                <Input {...field} placeholder="e.g. NB-A4-200" />
              </FormControl>
              <p className="text-xs text-muted-foreground">
                Your SKU — unique per company. Numbering stays manual until the Document Number
                Engine.
              </p>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
        <FormField
          control={control}
          name="productType"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Product Type *</FormLabel>
              <Select value={field.value} onValueChange={field.onChange}>
                <FormControl>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {PRODUCT_TYPE_VALUES.map((value) => (
                    <SelectItem key={value} value={value}>
                      {PRODUCT_TYPE_LABELS[value]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={control}
          name="barcode"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Barcode</FormLabel>
              <FormControl>
                <Input {...field} value={field.value ?? ""} placeholder="EAN/UPC or self-printed" />
              </FormControl>
              <p className="text-xs text-muted-foreground">
                Optional — unique per company when present. Scanning and printing come with
                Barcode Billing.
              </p>
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
            <FormMessage />
          </FormItem>
        )}
      />
    </section>
  );
}
