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
  createWarehouseAction,
  updateWarehouseAction,
} from "@/modules/warehouses/actions/warehouse-actions";
import { BranchSelector } from "@/modules/warehouses/components/branch-selector";
import {
  createWarehouseSchema,
  type CreateWarehouseInput,
} from "@/modules/warehouses/validation/warehouse-schema";
import type { Warehouse, WarehouseBranchOption } from "@/types/warehouse";

const LIST_PATH = "/masters/warehouses";

interface WarehouseFormProps {
  /** When present the form saves via update; otherwise it creates. Create and
   * Update share the same field set — every Warehouse field remains editable
   * (24-warehouse-management.md; isDefault changes only via the dedicated
   * set/unset default row actions) — so one component serves both screens,
   * mirroring gst-rate-form.tsx. */
  warehouse?: Warehouse;
  /** The branch picker's options (the company's active branches; empty until
   * Branch Management is implemented — a normal state, not an error). */
  branchOptions: WarehouseBranchOption[];
}

export function WarehouseForm({ warehouse, branchOptions }: WarehouseFormProps) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const isEdit = warehouse !== undefined;

  const form = useForm<CreateWarehouseInput>({
    resolver: zodResolver(createWarehouseSchema),
    defaultValues: {
      name: warehouse?.name ?? "",
      code: warehouse?.code ?? "",
      branchId: warehouse?.branchId ?? undefined,
      address: warehouse?.address ?? "",
      contactNumber: warehouse?.contactNumber ?? "",
    },
  });

  async function handleSubmit(data: CreateWarehouseInput) {
    setIsSubmitting(true);
    try {
      const result = isEdit
        ? await updateWarehouseAction(warehouse.id, data)
        : await createWarehouseAction(data);

      if (result.success) {
        toast.success(isEdit ? "Warehouse saved successfully." : "Warehouse created successfully.");
        router.push(LIST_PATH);
        router.refresh();
        return;
      }

      toast.error(
        result.error ?? (isEdit ? "Failed to save warehouse." : "Failed to create warehouse.")
      );
    } catch {
      // A Server Action can reject outright (network drop, server crash) —
      // surface it instead of silently re-enabling the button (the
      // brand-form.tsx / hsn-code-form.tsx defensive convention).
      toast.error(isEdit ? "Failed to save warehouse." : "Failed to create warehouse.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleSubmit)} className="flex max-w-xl flex-col gap-6">
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Name *</FormLabel>
                <FormControl>
                  <Input {...field} placeholder="e.g. Main Godown" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="code"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Code *</FormLabel>
                <FormControl>
                  <Input {...field} placeholder="e.g. WH-MAIN" />
                </FormControl>
                <p className="text-xs text-muted-foreground">
                  Short identifier printed on stock documents, unique per company.
                </p>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <FormField
          control={form.control}
          name="branchId"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Branch</FormLabel>
              <FormControl>
                <BranchSelector
                  branches={branchOptions}
                  value={field.value}
                  onChange={field.onChange}
                />
              </FormControl>
              <p className="text-xs text-muted-foreground">
                Optional. Ties the warehouse to a branch for future branch-wise stock reporting.
              </p>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="address"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Address</FormLabel>
              <FormControl>
                <Input {...field} value={field.value ?? ""} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="contactNumber"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Contact Number</FormLabel>
              <FormControl>
                <Input
                  {...field}
                  value={field.value ?? ""}
                  inputMode="numeric"
                  placeholder="10-digit mobile number"
                />
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
            {isSubmitting ? "Saving…" : isEdit ? "Save Changes" : "Create Warehouse"}
          </Button>
        </div>
      </form>
    </Form>
  );
}
