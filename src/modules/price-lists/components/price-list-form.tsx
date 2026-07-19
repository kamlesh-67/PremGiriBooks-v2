"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CUSTOMER_TYPE_LABELS } from "@/modules/customers/components/customer-type-badge";
import {
  createPriceListAction,
  updatePriceListAction,
} from "@/modules/price-lists/actions/price-list-actions";
import { toPriceListFormValues } from "@/modules/price-lists/utils/price-list-form-values";
import {
  createPriceListSchema,
  type CreatePriceListInput,
} from "@/modules/price-lists/validation/price-list-schema";
import { CUSTOMER_TYPE_VALUES } from "@/modules/customers/validation/customer-schema";
import type { CustomerType } from "@/types/customer";
import type { PriceListDetail } from "@/types/price-list";

const LIST_PATH = "/masters/price-lists";
const NONE_VALUE = "__any_tier__";

interface PriceListFormProps {
  /** When present the form saves via update; otherwise it creates. Items
   * (this codebase's first parent-child editor) are added on the edit
   * screen after creation — keeps create simple
   * (29-price-lists.md's UI). */
  priceList?: PriceListDetail;
}

export function PriceListForm({ priceList }: PriceListFormProps) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const isEdit = priceList !== undefined;

  const form = useForm<CreatePriceListInput>({
    resolver: zodResolver(createPriceListSchema),
    defaultValues: priceList
      ? toPriceListFormValues(priceList)
      : { name: "", customerType: undefined, effectiveFrom: undefined, effectiveTo: undefined, description: "" },
  });

  async function handleSubmit(data: CreatePriceListInput) {
    setIsSubmitting(true);
    try {
      if (isEdit) {
        const result = await updatePriceListAction(priceList.id, data);
        if (result.success) {
          toast.success("Price list saved successfully.");
          router.refresh();
          return;
        }
        toast.error(result.error ?? "Failed to save price list.");
        return;
      }

      const result = await createPriceListAction(data);
      if (result.success && result.data) {
        toast.success("Price list created successfully. Now add item rows below.");
        router.push(`/masters/price-lists/${result.data.id}/edit`);
        router.refresh();
        return;
      }
      toast.error(result.error ?? "Failed to create price list.");
    } catch {
      toast.error(isEdit ? "Failed to save price list." : "Failed to create price list.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleSubmit)} className="flex max-w-2xl flex-col gap-6">
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Name *</FormLabel>
              <FormControl>
                <Input {...field} placeholder="e.g. Diwali Wholesale Promo" />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="customerType"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Customer Tier</FormLabel>
              <Select
                value={field.value ?? NONE_VALUE}
                onValueChange={(next) =>
                  field.onChange(next === NONE_VALUE ? undefined : (next as CustomerType))
                }
              >
                <FormControl>
                  <SelectTrigger className="w-full">
                    <SelectValue>
                      {(current: string | null) =>
                        !current || current === NONE_VALUE
                          ? "Any Tier (Tier-Agnostic)"
                          : CUSTOMER_TYPE_LABELS[current as CustomerType]
                      }
                    </SelectValue>
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value={NONE_VALUE}>Any Tier (Tier-Agnostic)</SelectItem>
                  {CUSTOMER_TYPE_VALUES.map((type) => (
                    <SelectItem key={type} value={type}>
                      {CUSTOMER_TYPE_LABELS[type]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Restrict this list to one customer tier, or leave it tier-agnostic.
              </p>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <FormField
            control={form.control}
            name="effectiveFrom"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Effective From</FormLabel>
                <FormControl>
                  <Input {...field} value={field.value ?? ""} type="date" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="effectiveTo"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Effective To</FormLabel>
                <FormControl>
                  <Input {...field} value={field.value ?? ""} type="date" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
        <p className="-mt-4 text-xs text-muted-foreground">
          Leave both blank for an always-effective list, or set one side for an open-ended window.
        </p>

        <FormField
          control={form.control}
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

        <div className="flex justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => router.push(LIST_PATH)}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? "Saving…" : isEdit ? "Save Changes" : "Create Price List"}
          </Button>
        </div>
      </form>
    </Form>
  );
}
