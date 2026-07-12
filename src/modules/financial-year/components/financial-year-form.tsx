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
  financialYearSchema,
  type FinancialYearInput,
} from "@/modules/financial-year/validation/financial-year-schema";
import type { ActionResult } from "@/types/api";
import type { FinancialYear } from "@/types/financial-year";

interface FinancialYearFormProps {
  defaultValues?: Partial<FinancialYearInput>;
  onSubmit: (data: FinancialYearInput) => Promise<ActionResult<FinancialYear>>;
  submitLabel: string;
}

const BASE_DEFAULT_VALUES: FinancialYearInput = {
  name: "",
  startDate: "",
  endDate: "",
};

export function FinancialYearForm({
  defaultValues,
  onSubmit,
  submitLabel,
}: FinancialYearFormProps) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  const form = useForm<FinancialYearInput>({
    resolver: zodResolver(financialYearSchema),
    defaultValues: { ...BASE_DEFAULT_VALUES, ...defaultValues },
  });

  async function handleSubmit(data: FinancialYearInput) {
    setIsSubmitting(true);
    const result = await onSubmit(data);
    setIsSubmitting(false);

    if (result.success) {
      toast.success("Financial year saved successfully.");
      router.push("/financial-year");
      router.refresh();
      return;
    }

    toast.error(result.error ?? "Failed to save financial year.");
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleSubmit)} className="flex flex-col gap-8">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Name *</FormLabel>
                <FormControl>
                  <Input {...field} placeholder="2026-2027" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="startDate"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Start Date *</FormLabel>
                <FormControl>
                  <Input {...field} type="date" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="endDate"
            render={({ field }) => (
              <FormItem>
                <FormLabel>End Date *</FormLabel>
                <FormControl>
                  <Input {...field} type="date" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="flex justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => router.push("/financial-year")}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? "Saving…" : submitLabel}
          </Button>
        </div>
      </form>
    </Form>
  );
}
