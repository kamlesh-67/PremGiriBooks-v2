"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { LedgerGroupSelector } from "@/modules/ledger-groups/components/ledger-group-selector";
import {
  createLedgerGroupSchema,
  type CreateLedgerGroupInput,
} from "@/modules/ledger-groups/validation/ledger-group-schema";
import type { ActionResult } from "@/types/api";
import type { LedgerGroup } from "@/types/ledger-group";

interface LedgerGroupFormProps {
  groups: LedgerGroup[];
  onSubmit: (data: CreateLedgerGroupInput) => Promise<ActionResult<LedgerGroup>>;
}

const DEFAULT_VALUES: CreateLedgerGroupInput = {
  name: "",
};

export function LedgerGroupForm({ groups, onSubmit }: LedgerGroupFormProps) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  const form = useForm<CreateLedgerGroupInput>({
    resolver: zodResolver(createLedgerGroupSchema),
    defaultValues: DEFAULT_VALUES,
  });

  const parentGroupId = useWatch({ control: form.control, name: "parentGroupId" });
  const natureType = useWatch({ control: form.control, name: "natureType" });
  const isTopLevel = !parentGroupId;
  const showAffectsGrossProfit =
    isTopLevel && (natureType === "INCOME" || natureType === "EXPENSE");

  // Whenever the field becomes inapplicable (a parent is selected, or the
  // nature changes to ASSET/LIABILITY/unset), clear its stale value — Zod's
  // superRefine rejects a leftover `true` here, but the field wouldn't be
  // mounted to show that error, producing a silent submit failure.
  React.useEffect(() => {
    if (!showAffectsGrossProfit) {
      form.setValue("affectsGrossProfit", undefined, { shouldDirty: true });
    }
  }, [showAffectsGrossProfit, form]);

  async function handleSubmit(data: CreateLedgerGroupInput) {
    setIsSubmitting(true);
    const result = await onSubmit(data);
    setIsSubmitting(false);

    if (result.success) {
      toast.success("Ledger group created successfully.");
      router.push("/accounting/ledger-groups");
      router.refresh();
      return;
    }

    toast.error(result.error ?? "Failed to create ledger group.");
  }

  function handleParentChange(groupId: string | undefined) {
    form.setValue("parentGroupId", groupId, { shouldDirty: true });
    if (groupId) {
      form.setValue("natureType", undefined, { shouldDirty: true });
      form.setValue("affectsGrossProfit", undefined, { shouldDirty: true });
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
                <Input {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="flex flex-col gap-2">
          <Label>Parent Group</Label>
          <LedgerGroupSelector
            groups={groups}
            value={parentGroupId}
            onChange={handleParentChange}
            placeholder="No parent (top-level group)"
          />
          <p className="text-xs text-muted-foreground">
            Leave unset to create a top-level group with its own Nature. A sub-group always
            inherits its parent&apos;s Nature and Gross Profit classification.
          </p>
        </div>

        {isTopLevel ? (
          <FormField
            control={form.control}
            name="natureType"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Nature *</FormLabel>
                <Select value={field.value ?? ""} onValueChange={field.onChange}>
                  <FormControl>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select a nature" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="ASSET">Asset</SelectItem>
                    <SelectItem value="LIABILITY">Liability</SelectItem>
                    <SelectItem value="INCOME">Income</SelectItem>
                    <SelectItem value="EXPENSE">Expense</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
        ) : null}

        {showAffectsGrossProfit ? (
          <FormField
            control={form.control}
            name="affectsGrossProfit"
            render={({ field }) => (
              <FormItem>
                <div className="group/field flex items-center gap-2">
                  <FormControl>
                    <Checkbox
                      checked={field.value ?? false}
                      onCheckedChange={(checked) => field.onChange(checked === true)}
                    />
                  </FormControl>
                  <FormLabel className="!mt-0">
                    Affects Gross Profit (Direct — contributes to Gross Profit)
                  </FormLabel>
                </div>
                <FormMessage />
              </FormItem>
            )}
          />
        ) : null}

        <FormField
          control={form.control}
          name="remarks"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Remarks</FormLabel>
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
            onClick={() => router.push("/accounting/ledger-groups")}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? "Saving…" : "Create Ledger Group"}
          </Button>
        </div>
      </form>
    </Form>
  );
}
