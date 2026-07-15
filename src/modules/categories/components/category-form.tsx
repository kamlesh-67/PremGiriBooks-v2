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
  createCategoryAction,
  updateCategoryAction,
} from "@/modules/categories/actions/category-actions";
import { CategorySelector } from "@/modules/categories/components/category-selector";
import {
  createCategorySchema,
  type CreateCategoryInput,
} from "@/modules/categories/validation/category-schema";
import type { Category } from "@/types/category";

const LIST_PATH = "/masters/categories";

interface CategoryFormProps {
  /** When present the form saves via update; otherwise it creates. Create and
   * Update share the same field set — every Category field remains editable,
   * including the parent (20-category-management.md) — so one component
   * serves both screens, mirroring unit-form.tsx. */
  category?: Category;
  /**
   * Pickable parent categories. The edit page passes a list that already
   * excludes the category being edited and its descendants (the no-cycle
   * rule); the server re-verifies regardless.
   */
  parentOptions: Category[];
}

export function CategoryForm({ category, parentOptions }: CategoryFormProps) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const isEdit = category !== undefined;

  const form = useForm<CreateCategoryInput>({
    resolver: zodResolver(createCategorySchema),
    defaultValues: {
      name: category?.name ?? "",
      parentCategoryId: category?.parentCategoryId ?? undefined,
      description: category?.description ?? "",
    },
  });

  async function handleSubmit(data: CreateCategoryInput) {
    setIsSubmitting(true);
    try {
      const result = isEdit
        ? await updateCategoryAction(category.id, data)
        : await createCategoryAction(data);

      if (result.success) {
        toast.success(isEdit ? "Category saved successfully." : "Category created successfully.");
        router.push(LIST_PATH);
        router.refresh();
        return;
      }

      toast.error(result.error ?? (isEdit ? "Failed to save category." : "Failed to create category."));
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
                <Input {...field} placeholder="e.g. Notebooks" />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="parentCategoryId"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Parent Category</FormLabel>
              <FormControl>
                <CategorySelector
                  categories={parentOptions}
                  value={field.value}
                  onChange={field.onChange}
                  placeholder="No parent (top-level category)"
                />
              </FormControl>
              <p className="text-xs text-muted-foreground">
                Leave unset for a top-level category. A category cannot be moved under itself or
                one of its own sub-categories.
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
            {isSubmitting ? "Saving…" : isEdit ? "Save Changes" : "Create Category"}
          </Button>
        </div>
      </form>
    </Form>
  );
}
