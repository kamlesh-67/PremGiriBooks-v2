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
import {
  createHsnCodeAction,
  updateHsnCodeAction,
} from "@/modules/hsn-codes/actions/hsn-code-actions";
import {
  createHsnCodeSchema,
  HSN_CODE_TYPES,
  type CreateHsnCodeInput,
} from "@/modules/hsn-codes/validation/hsn-code-schema";
import type { HsnCode } from "@/types/hsn-code";

const LIST_PATH = "/masters/hsn-codes";

const CODE_TYPE_LABELS: Record<(typeof HSN_CODE_TYPES)[number], string> = {
  HSN: "HSN — goods",
  SAC: "SAC — services",
};

interface HsnCodeFormProps {
  /** When present the form saves via update; otherwise it creates. Create and
   * Update share the same field set — every HsnCode field remains editable,
   * including code and codeType (22-hsn-management.md) — so one component
   * serves both screens. */
  hsnCode?: HsnCode;
}

export function HsnCodeForm({ hsnCode }: HsnCodeFormProps) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const isEdit = hsnCode !== undefined;

  const form = useForm<CreateHsnCodeInput>({
    resolver: zodResolver(createHsnCodeSchema),
    defaultValues: {
      code: hsnCode?.code ?? "",
      codeType: hsnCode?.codeType ?? "HSN",
      description: hsnCode?.description ?? "",
    },
  });

  // Mirrored in local state (rather than form.watch(), which the React
  // Compiler cannot memoize safely — react-hooks/incompatible-library) so the
  // Code field's placeholder/helper text tracks the selected code type.
  const [codeType, setCodeType] = React.useState<CreateHsnCodeInput["codeType"]>(
    hsnCode?.codeType ?? "HSN"
  );

  async function handleSubmit(data: CreateHsnCodeInput) {
    setIsSubmitting(true);
    try {
      const result = isEdit
        ? await updateHsnCodeAction(hsnCode.id, data)
        : await createHsnCodeAction(data);

      if (result.success) {
        toast.success(isEdit ? "HSN/SAC code saved successfully." : "HSN/SAC code created successfully.");
        router.push(LIST_PATH);
        router.refresh();
        return;
      }

      toast.error(
        result.error ?? (isEdit ? "Failed to save HSN/SAC code." : "Failed to create HSN/SAC code.")
      );
    } catch {
      toast.error(isEdit ? "Failed to save HSN/SAC code." : "Failed to create HSN/SAC code.");
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
            name="codeType"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Code Type *</FormLabel>
                <Select
                  value={field.value}
                  onValueChange={(value) => {
                    field.onChange(value);
                    setCodeType(value as CreateHsnCodeInput["codeType"]);
                  }}
                >
                  <FormControl>
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {HSN_CODE_TYPES.map((option) => (
                      <SelectItem key={option} value={option}>
                        {CODE_TYPE_LABELS[option]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  HSN classifies goods; SAC classifies services.
                </p>
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
                  <Input
                    {...field}
                    inputMode="numeric"
                    placeholder={codeType === "SAC" ? "e.g. 998599" : "e.g. 4901"}
                  />
                </FormControl>
                <p className="text-xs text-muted-foreground">
                  {codeType === "SAC"
                    ? "Exactly 6 digits."
                    : "Exactly 4, 6, or 8 digits — the lengths GST returns accept."}
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
              <FormLabel>Description *</FormLabel>
              <FormControl>
                <Input {...field} placeholder="e.g. Printed books" />
              </FormControl>
              <p className="text-xs text-muted-foreground">
                Required — GST returns report a description per code line.
              </p>
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
            {isSubmitting ? "Saving…" : isEdit ? "Save Changes" : "Create HSN/SAC Code"}
          </Button>
        </div>
      </form>
    </Form>
  );
}
