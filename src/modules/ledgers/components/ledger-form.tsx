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
import { LedgerGroupSelector } from "@/modules/ledger-groups/components/ledger-group-selector";
import { createLedgerSchema, type CreateLedgerInput } from "@/modules/ledgers/validation/ledger-schema";
import type { ActionResult } from "@/types/api";
import type { LedgerGroup } from "@/types/ledger-group";
import type { Ledger } from "@/types/ledger";

interface LedgerFormProps {
  groups: LedgerGroup[];
  onSubmit: (data: CreateLedgerInput) => Promise<ActionResult<Ledger>>;
  /** List route to return to on Cancel / after a successful create. */
  listPath?: string;
  /** Noun used in the submit button and toasts, e.g. "Expense Head". */
  entityLabel?: string;
  /** Helper text under the Ledger Group picker; null hides it. */
  groupHelperText?: string | null;
}

const DEFAULT_VALUES: CreateLedgerInput = {
  name: "",
  ledgerGroupId: "",
  openingBalance: 0,
  openingBalanceType: "DEBIT",
};

const DEFAULT_GROUP_HELPER_TEXT =
  'Ledgers under "Bank Accounts" can only be created through Bank Management.';

export function LedgerForm({
  groups,
  onSubmit,
  listPath = "/accounting/ledgers",
  entityLabel = "Ledger",
  groupHelperText = DEFAULT_GROUP_HELPER_TEXT,
}: LedgerFormProps) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  const form = useForm<CreateLedgerInput>({
    resolver: zodResolver(createLedgerSchema),
    defaultValues: DEFAULT_VALUES,
  });

  async function handleSubmit(data: CreateLedgerInput) {
    setIsSubmitting(true);
    const result = await onSubmit(data);
    setIsSubmitting(false);

    if (result.success) {
      toast.success(`${entityLabel} created successfully.`);
      router.push(listPath);
      router.refresh();
      return;
    }

    toast.error(result.error ?? `Failed to create ${entityLabel.toLowerCase()}.`);
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

        <FormField
          control={form.control}
          name="ledgerGroupId"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Ledger Group *</FormLabel>
              <LedgerGroupSelector
                groups={groups}
                value={field.value || undefined}
                onChange={(groupId) => field.onChange(groupId ?? "")}
                allowNone={false}
                placeholder="Select a ledger group"
              />
              {groupHelperText ? (
                <p className="text-xs text-muted-foreground">{groupHelperText}</p>
              ) : null}
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
          <FormField
            control={form.control}
            name="openingBalance"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Opening Balance</FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    min={0}
                    step="0.01"
                    {...field}
                    onChange={(event) => field.onChange(event.target.valueAsNumber)}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="openingBalanceType"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Opening Balance Type</FormLabel>
                <Select value={field.value} onValueChange={field.onChange}>
                  <FormControl>
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="DEBIT">Debit</SelectItem>
                    <SelectItem value="CREDIT">Credit</SelectItem>
                  </SelectContent>
                </Select>
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
            onClick={() => router.push(listPath)}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? "Saving…" : `Create ${entityLabel}`}
          </Button>
        </div>
      </form>
    </Form>
  );
}
