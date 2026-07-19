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
  createMarginProfileAction,
  updateMarginProfileAction,
} from "@/modules/margin-profiles/actions/margin-profile-actions";
import { PRICE_CALCULATION_MODE_LABELS } from "@/modules/margin-profiles/components/margin-profile-mode-badge";
import {
  createMarginProfileSchema,
  MARGIN_MAX_PERCENT,
  MARGIN_PROFILE_TIER_FIELDS,
  MARKUP_MAX_PERCENT,
  PRICE_CALCULATION_MODES,
  type CreateMarginProfileInput,
} from "@/modules/margin-profiles/validation/margin-profile-schema";
import type { MarginProfile } from "@/types/margin-profile";

const LIST_PATH = "/masters/margin-profiles";

// Display text only, no calculation performed here or anywhere in this
// module — applying the formula is exclusively the Pricing Engine's (#28)
// job (28-margin-profiles.md, architecture-context.md Invariant 6).
const MODE_EXPLANATIONS: Record<(typeof PRICE_CALCULATION_MODES)[number], string> = {
  MARGIN: "Margin: price = cost ÷ (1 − % / 100)",
  MARKUP: "Markup: price = cost × (1 + % / 100)",
};

interface MarginProfileFormProps {
  /** When present the form saves via update; otherwise it creates. Create and
   * Update share the same field set (28-margin-profiles.md), so one form
   * serves both screens, mirroring gst-rate-form.tsx. */
  marginProfile?: MarginProfile;
}

export function MarginProfileForm({ marginProfile }: MarginProfileFormProps) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const isEdit = marginProfile !== undefined;

  const form = useForm<CreateMarginProfileInput>({
    resolver: zodResolver(createMarginProfileSchema),
    defaultValues: {
      name: marginProfile?.name ?? "",
      calculationMode: marginProfile?.calculationMode ?? "MARGIN",
      retailPercent: marginProfile?.retailPercent ?? 0,
      wholesalePercent: marginProfile?.wholesalePercent ?? 0,
      dealerPercent: marginProfile?.dealerPercent ?? 0,
      distributorPercent: marginProfile?.distributorPercent ?? 0,
      description: marginProfile?.description ?? "",
    },
  });

  // Mirrored in local state (rather than form.watch(), which the React
  // Compiler cannot memoize safely — react-hooks/incompatible-library) so the
  // explanatory line and the percent inputs' max hint track the selected
  // mode.
  const [calculationMode, setCalculationMode] = React.useState<
    CreateMarginProfileInput["calculationMode"]
  >(marginProfile?.calculationMode ?? "MARGIN");
  const maxPercent = calculationMode === "MARGIN" ? MARGIN_MAX_PERCENT : MARKUP_MAX_PERCENT;

  async function handleSubmit(data: CreateMarginProfileInput) {
    setIsSubmitting(true);
    try {
      const result = isEdit
        ? await updateMarginProfileAction(marginProfile.id, data)
        : await createMarginProfileAction(data);

      if (result.success) {
        toast.success(
          isEdit ? "Margin profile saved successfully." : "Margin profile created successfully."
        );
        router.push(LIST_PATH);
        router.refresh();
        return;
      }

      toast.error(
        result.error ?? (isEdit ? "Failed to save margin profile." : "Failed to create margin profile.")
      );
    } catch {
      toast.error(isEdit ? "Failed to save margin profile." : "Failed to create margin profile.");
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
                <Input {...field} placeholder="e.g. Standard Margin Profile" />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="calculationMode"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Calculation Mode *</FormLabel>
              <Select
                value={field.value}
                onValueChange={(value) => {
                  field.onChange(value);
                  setCalculationMode(value as CreateMarginProfileInput["calculationMode"]);
                }}
              >
                <FormControl>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {PRICE_CALCULATION_MODES.map((option) => (
                    <SelectItem key={option} value={option}>
                      {PRICE_CALCULATION_MODE_LABELS[option]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                {MODE_EXPLANATIONS[calculationMode]}
              </p>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
          {MARGIN_PROFILE_TIER_FIELDS.map(({ name, label }) => (
            <FormField
              key={name}
              control={form.control}
              name={name}
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{label} *</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      min={0}
                      max={maxPercent}
                      step="0.01"
                      {...field}
                      onChange={(event) =>
                        // Blank → undefined so the schema's "must be a
                        // number" message fires instead of the range message
                        // (NaN passes typeof number, so min/max would report
                        // the misleading "0 or more" for an empty field).
                        field.onChange(
                          Number.isNaN(event.target.valueAsNumber)
                            ? undefined
                            : event.target.valueAsNumber
                        )
                      }
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          ))}
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
            {isSubmitting ? "Saving…" : isEdit ? "Save Changes" : "Create Margin Profile"}
          </Button>
        </div>
      </form>
    </Form>
  );
}
