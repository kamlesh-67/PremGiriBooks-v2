"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import { AccountNatureBadge } from "@/modules/ledger-groups/components/account-nature-badge";
import { updateLedgerAction } from "@/modules/ledgers/actions/ledger-actions";
import { updateLedgerSchema, type UpdateLedgerInput } from "@/modules/ledgers/validation/ledger-schema";
import type { LedgerWithGroup } from "@/types/ledger";

interface LedgerEditFormProps {
  ledger: LedgerWithGroup;
}

// The system-defined "Cash" ledger can never be renamed or deactivated
// (14-ledger-master.md), but — unlike 13-ledger-groups.md's system-defined
// groups, whose Edit form locks every field — its opening balance,
// description, and balance type remain editable, since a business
// legitimately needs to set its real starting cash-in-hand balance.
export function LedgerEditForm({ ledger }: LedgerEditFormProps) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const isNameLocked = ledger.isSystemDefined;

  const form = useForm<UpdateLedgerInput>({
    resolver: zodResolver(updateLedgerSchema),
    defaultValues: {
      name: ledger.name,
      openingBalance: ledger.openingBalance,
      openingBalanceType: ledger.openingBalanceType,
      description: ledger.description ?? undefined,
    },
  });

  async function handleSubmit(data: UpdateLedgerInput) {
    setIsSubmitting(true);
    const result = await updateLedgerAction(ledger.id, data);
    setIsSubmitting(false);

    if (result.success) {
      toast.success("Ledger saved successfully.");
      router.push("/accounting/ledgers");
      router.refresh();
      return;
    }

    toast.error(result.error ?? "Failed to save ledger.");
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleSubmit)} className="flex max-w-xl flex-col gap-6">
        <div className="flex flex-wrap items-center gap-2">
          <AccountNatureBadge nature={ledger.ledgerGroup.natureType} />
          {ledger.isSystemDefined ? <Badge variant="secondary">System-defined</Badge> : null}
        </div>

        <div className="flex flex-col gap-2">
          <Label>Ledger Group</Label>
          <p className="text-sm text-muted-foreground">
            {ledger.ledgerGroup.name} — the ledger group cannot be changed after creation.
          </p>
        </div>

        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Name *</FormLabel>
              <FormControl>
                <Input {...field} disabled={isNameLocked} />
              </FormControl>
              {isNameLocked ? (
                <p className="text-xs text-muted-foreground">
                  The system-defined &quot;Cash&quot; ledger cannot be renamed.
                </p>
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
            onClick={() => router.push("/accounting/ledgers")}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? "Saving…" : "Save Changes"}
          </Button>
        </div>
      </form>
    </Form>
  );
}
