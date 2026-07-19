"use client";

import type { Control } from "react-hook-form";

import { Input } from "@/components/ui/input";
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { LedgerGroupSelector } from "@/modules/ledger-groups/components/ledger-group-selector";
import type { CreateSupplierInput } from "@/modules/suppliers/validation/supplier-schema";
import type { LedgerGroup } from "@/types/ledger-group";

interface SupplierIdentitySectionProps {
  control: Control<CreateSupplierInput>;
  /** Active "Sundry Creditors"-subtree groups. Per 27-supplier-management.md:
   * when the company has no custom sub-groups (length === 1), no picker is
   * shown — the single group's name renders as plain text (the
   * customer-identity-section.tsx rule verbatim). */
  groups: LedgerGroup[];
}

/** Identity: display name (the underlying Ledger's name) and the Ledger
 * Group within "Sundry Creditors" — no customerType-equivalent field, since
 * nothing prices purchases by supplier tier. */
export function SupplierIdentitySection({ control, groups }: SupplierIdentitySectionProps) {
  const singleGroup = groups.length === 1 ? groups[0] : null;

  return (
    <section className="flex flex-col gap-4">
      <h2 className="text-sm font-semibold text-foreground">Identity</h2>

      <FormField
        control={control}
        name="displayName"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Display Name *</FormLabel>
            <FormControl>
              <Input {...field} placeholder="e.g. Sharma Paper Traders" />
            </FormControl>
            <p className="text-xs text-muted-foreground">
              The supplier&apos;s ledger name — unique per company.
            </p>
            <FormMessage />
          </FormItem>
        )}
      />

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
