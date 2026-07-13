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
import { AccountNatureBadge } from "@/modules/ledger-groups/components/account-nature-badge";
import { updateLedgerGroupAction } from "@/modules/ledger-groups/actions/ledger-group-actions";
import {
  updateLedgerGroupSchema,
  type UpdateLedgerGroupInput,
} from "@/modules/ledger-groups/validation/ledger-group-schema";
import type { LedgerGroup } from "@/types/ledger-group";

interface LedgerGroupEditFormProps {
  ledgerGroup: LedgerGroup;
  parentName: string | null;
}

export function LedgerGroupEditForm({ ledgerGroup, parentName }: LedgerGroupEditFormProps) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const isLocked = ledgerGroup.isSystemDefined;

  const form = useForm<UpdateLedgerGroupInput>({
    resolver: zodResolver(updateLedgerGroupSchema),
    defaultValues: {
      name: ledgerGroup.name,
      remarks: ledgerGroup.remarks ?? undefined,
    },
  });

  async function handleSubmit(data: UpdateLedgerGroupInput) {
    setIsSubmitting(true);
    const result = await updateLedgerGroupAction(ledgerGroup.id, data);
    setIsSubmitting(false);

    if (result.success) {
      toast.success("Ledger group saved successfully.");
      router.push("/accounting/ledger-groups");
      router.refresh();
      return;
    }

    toast.error(result.error ?? "Failed to save ledger group.");
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleSubmit)} className="flex max-w-xl flex-col gap-6">
        <div className="flex flex-wrap items-center gap-2">
          <AccountNatureBadge nature={ledgerGroup.natureType} />
          {isLocked ? <Badge variant="secondary">System-defined</Badge> : null}
        </div>

        <div className="flex flex-col gap-2">
          <Label>Parent Group</Label>
          <p className="text-sm text-muted-foreground">
            {parentName ?? "None (top-level group)"} — Parent, Nature, and Gross Profit
            classification cannot be changed after creation.
          </p>
        </div>

        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Name *</FormLabel>
              <FormControl>
                <Input {...field} disabled={isLocked} />
              </FormControl>
              {isLocked ? (
                <p className="text-xs text-muted-foreground">
                  System-defined groups cannot be renamed.
                </p>
              ) : null}
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="remarks"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Remarks</FormLabel>
              <FormControl>
                <Input {...field} value={field.value ?? ""} disabled={isLocked} />
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
            {isLocked ? "Back" : "Cancel"}
          </Button>
          {isLocked ? null : (
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Saving…" : "Save Changes"}
            </Button>
          )}
        </div>
      </form>
    </Form>
  );
}
