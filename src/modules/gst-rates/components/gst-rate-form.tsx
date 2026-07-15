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
  createGstRateAction,
  updateGstRateAction,
} from "@/modules/gst-rates/actions/gst-rate-actions";
import {
  createGstRateSchema,
  type CreateGstRateInput,
} from "@/modules/gst-rates/validation/gst-rate-schema";
import type { GstRate } from "@/types/gst-rate";

const LIST_PATH = "/masters/gst-rates";

interface GstRateFormProps {
  /** When present the form saves via update; otherwise it creates. Create and
   * Update share the same field set — every GstRate field remains editable
   * (23-gst-rate-management.md) — so one component serves both screens. */
  gstRate?: GstRate;
}

export function GstRateForm({ gstRate }: GstRateFormProps) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const isEdit = gstRate !== undefined;

  const form = useForm<CreateGstRateInput>({
    resolver: zodResolver(createGstRateSchema),
    defaultValues: {
      name: gstRate?.name ?? "",
      ratePercent: gstRate?.ratePercent ?? 0,
      cessPercent: gstRate?.cessPercent ?? 0,
      description: gstRate?.description ?? "",
    },
  });

  async function handleSubmit(data: CreateGstRateInput) {
    setIsSubmitting(true);
    try {
      const result = isEdit
        ? await updateGstRateAction(gstRate.id, data)
        : await createGstRateAction(data);

      if (result.success) {
        toast.success(isEdit ? "GST rate saved successfully." : "GST rate created successfully.");
        router.push(LIST_PATH);
        router.refresh();
        return;
      }

      toast.error(
        result.error ?? (isEdit ? "Failed to save GST rate." : "Failed to create GST rate.")
      );
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
                <Input {...field} placeholder='e.g. GST 18% or "GST 28% + 12% Cess"' />
              </FormControl>
              <p className="text-xs text-muted-foreground">
                The label shown in pickers and printed on documents.
              </p>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
          <FormField
            control={form.control}
            name="ratePercent"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Rate % *</FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    min={0}
                    max={100}
                    step="0.01"
                    {...field}
                    onChange={(event) =>
                      // Blank → undefined so the schema's "must be a number"
                      // message fires instead of the range message (NaN
                      // passes typeof number, so min/max would report the
                      // misleading "between 0 and 100" for an empty field).
                      field.onChange(
                        Number.isNaN(event.target.valueAsNumber)
                          ? undefined
                          : event.target.valueAsNumber
                      )
                    }
                  />
                </FormControl>
                <p className="text-xs text-muted-foreground">
                  The total GST rate, 0–100 with up to 2 decimals — e.g. 18 or 0.25.
                </p>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="cessPercent"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Cess %</FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    min={0}
                    max={100}
                    step="0.01"
                    {...field}
                    value={field.value ?? ""}
                    onChange={(event) =>
                      // Blank clears the optional field instead of failing
                      // "must be a number" (valueAsNumber is NaN for "").
                      field.onChange(
                        Number.isNaN(event.target.valueAsNumber)
                          ? undefined
                          : event.target.valueAsNumber
                      )
                    }
                  />
                </FormControl>
                <p className="text-xs text-muted-foreground">
                  Optional compensation cess percentage. Leave blank or 0 when none applies.
                </p>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

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
            {isSubmitting ? "Saving…" : isEdit ? "Save Changes" : "Create GST Rate"}
          </Button>
        </div>
      </form>
    </Form>
  );
}
