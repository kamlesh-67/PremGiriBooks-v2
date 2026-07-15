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
import { createBrandAction, updateBrandAction } from "@/modules/brands/actions/brand-actions";
import { createBrandSchema, type CreateBrandInput } from "@/modules/brands/validation/brand-schema";
import type { Brand } from "@/types/brand";

const LIST_PATH = "/masters/brands";

interface BrandFormProps {
  /** When present the form saves via update; otherwise it creates. Create and
   * Update share the same field set — every Brand field remains editable
   * (21-brand-management.md) — so one component serves both screens. */
  brand?: Brand;
}

export function BrandForm({ brand }: BrandFormProps) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const isEdit = brand !== undefined;

  const form = useForm<CreateBrandInput>({
    resolver: zodResolver(createBrandSchema),
    defaultValues: {
      name: brand?.name ?? "",
      description: brand?.description ?? "",
    },
  });

  async function handleSubmit(data: CreateBrandInput) {
    setIsSubmitting(true);
    try {
      const result = isEdit
        ? await updateBrandAction(brand.id, data)
        : await createBrandAction(data);

      if (result.success) {
        toast.success(isEdit ? "Brand saved successfully." : "Brand created successfully.");
        router.push(LIST_PATH);
        router.refresh();
        return;
      }

      toast.error(result.error ?? (isEdit ? "Failed to save brand." : "Failed to create brand."));
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
                <Input {...field} placeholder="e.g. Penguin Random House" />
              </FormControl>
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
            {isSubmitting ? "Saving…" : isEdit ? "Save Changes" : "Create Brand"}
          </Button>
        </div>
      </form>
    </Form>
  );
}
