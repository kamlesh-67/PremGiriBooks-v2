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
import { createUnitAction, updateUnitAction } from "@/modules/units/actions/unit-actions";
import { createUnitSchema, type CreateUnitInput } from "@/modules/units/validation/unit-schema";
import type { Unit } from "@/types/unit";

const LIST_PATH = "/masters/units";

// 0–4, matching unit-schema.ts's DECIMAL_PLACES_SCHEMA bounds. Rendered as a
// Select rather than a numeric input so an unparseable/NaN value is
// impossible by construction.
const DECIMAL_PLACES_OPTIONS = ["0", "1", "2", "3", "4"] as const;

interface UnitFormProps {
  /** When present the form saves via update; otherwise it creates. Create and
   * Update share the same field set — every Unit field remains editable
   * (19-unit-management.md) — so one component serves both screens. */
  unit?: Unit;
}

export function UnitForm({ unit }: UnitFormProps) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const isEdit = unit !== undefined;

  const form = useForm<CreateUnitInput>({
    resolver: zodResolver(createUnitSchema),
    defaultValues: {
      name: unit?.name ?? "",
      symbol: unit?.symbol ?? "",
      uqcCode: unit?.uqcCode ?? "",
      decimalPlaces: unit?.decimalPlaces ?? 0,
      description: unit?.description ?? "",
    },
  });

  async function handleSubmit(data: CreateUnitInput) {
    setIsSubmitting(true);
    try {
      const result = isEdit ? await updateUnitAction(unit.id, data) : await createUnitAction(data);

      if (result.success) {
        toast.success(isEdit ? "Unit saved successfully." : "Unit created successfully.");
        router.push(LIST_PATH);
        router.refresh();
        return;
      }

      toast.error(result.error ?? (isEdit ? "Failed to save unit." : "Failed to create unit."));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleSubmit)} className="flex max-w-xl flex-col gap-6">
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Name *</FormLabel>
              <FormControl>
                <Input {...field} placeholder="e.g. Pieces" />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
          <FormField
            control={form.control}
            name="symbol"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Symbol *</FormLabel>
                <FormControl>
                  <Input {...field} placeholder="e.g. PCS" />
                </FormControl>
                <p className="text-xs text-muted-foreground">
                  The short form shown in quantity columns and printed on documents.
                </p>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="uqcCode"
            render={({ field }) => (
              <FormItem>
                <FormLabel>UQC Code</FormLabel>
                <FormControl>
                  <Input {...field} value={field.value ?? ""} placeholder="e.g. PCS, KGS, MTR" />
                </FormControl>
                <p className="text-xs text-muted-foreground">
                  Optional GST Unit Quantity Code, used later in GST returns.
                </p>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <FormField
          control={form.control}
          name="decimalPlaces"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Decimal Places</FormLabel>
              <Select
                value={String(field.value)}
                onValueChange={(value) => field.onChange(Number(value))}
              >
                <FormControl>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {DECIMAL_PLACES_OPTIONS.map((option) => (
                    <SelectItem key={option} value={option}>
                      {option}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                How many decimals a quantity in this unit may carry — e.g. 0 for Pieces, 3 for
                Kilograms.
              </p>
              <FormMessage />
            </FormItem>
          )}
        />

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
            {isSubmitting ? "Saving…" : isEdit ? "Save Changes" : "Create Unit"}
          </Button>
        </div>
      </form>
    </Form>
  );
}
