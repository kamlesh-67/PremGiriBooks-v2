"use client";

import type { Control } from "react-hook-form";

import { Input } from "@/components/ui/input";
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { LedgerGroupSelector } from "@/modules/ledger-groups/components/ledger-group-selector";
import { CUSTOMER_TYPE_LABELS } from "@/modules/customers/components/customer-type-badge";
import {
  CUSTOMER_TYPE_VALUES,
  type CreateCustomerInput,
} from "@/modules/customers/validation/customer-schema";
import type { LedgerGroup } from "@/types/ledger-group";

interface CustomerIdentitySectionProps {
  control: Control<CreateCustomerInput>;
  /** Active "Sundry Debtors"-subtree groups. Per 26-customer-management.md:
   * when the company has no custom sub-groups (length === 1), no picker is
   * shown — the single group's name renders as plain text (the
   * bank-account-form.tsx rule verbatim). */
  groups: LedgerGroup[];
}

/** Identity: display name (the underlying Ledger's name), customer type,
 * and the Ledger Group within "Sundry Debtors". */
export function CustomerIdentitySection({ control, groups }: CustomerIdentitySectionProps) {
  const singleGroup = groups.length === 1 ? groups[0] : null;

  return (
    <section className="flex flex-col gap-4">
      <h2 className="text-sm font-semibold text-foreground">Identity</h2>

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
        <FormField
          control={control}
          name="displayName"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Display Name *</FormLabel>
              <FormControl>
                <Input {...field} placeholder="e.g. Sharma Book Depot" />
              </FormControl>
              <p className="text-xs text-muted-foreground">
                The customer&apos;s ledger name — unique per company.
              </p>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={control}
          name="customerType"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Customer Type *</FormLabel>
              <Select value={field.value} onValueChange={field.onChange}>
                <FormControl>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {CUSTOMER_TYPE_VALUES.map((value) => (
                    <SelectItem key={value} value={value}>
                      {CUSTOMER_TYPE_LABELS[value]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                The pricing tier future price lists and the Pricing Engine will key on.
              </p>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>

      <FormField
        control={control}
        name="ledgerGroupId"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Ledger Group *</FormLabel>
            {singleGroup ? (
              <p className="text-sm text-muted-foreground">{singleGroup.name}</p>
            ) : (
              <LedgerGroupSelector
                groups={groups}
                value={field.value || undefined}
                onChange={(groupId) => field.onChange(groupId ?? "")}
                allowNone={false}
                placeholder="Select a ledger group"
              />
            )}
            <FormMessage />
          </FormItem>
        )}
      />
    </section>
  );
}
