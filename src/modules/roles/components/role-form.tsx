"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import type { Role } from "@prisma/client";
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
import { roleSchema, type RoleFormInput } from "@/modules/roles/validation/role-schema";
import type { ActionResult } from "@/types/api";

interface RoleFormProps {
  mode: "create" | "edit";
  defaultValues?: Partial<RoleFormInput>;
  onSubmit: (data: RoleFormInput) => Promise<ActionResult<Role>>;
  submitLabel: string;
}

const BASE_DEFAULT_VALUES: RoleFormInput = { name: "" };

export function RoleForm({ mode, defaultValues, onSubmit, submitLabel }: RoleFormProps) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  const form = useForm<RoleFormInput>({
    resolver: zodResolver(roleSchema),
    defaultValues: { ...BASE_DEFAULT_VALUES, ...defaultValues },
  });

  async function handleSubmit(data: RoleFormInput) {
    setIsSubmitting(true);
    try {
      const result = await onSubmit(data);

      if (!result.success || !result.data) {
        toast.error(result.error ?? "Failed to save role.");
        return;
      }

      toast.success("Role saved successfully.");
      if (mode === "create") {
        router.push(`/settings/roles/${result.data.id}/edit`);
      }
      router.refresh();
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleSubmit)} className="flex flex-col gap-6">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Role Name *</FormLabel>
                <FormControl>
                  <Input {...field} disabled={isSubmitting} />
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
            onClick={() => router.push("/settings/roles")}
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
