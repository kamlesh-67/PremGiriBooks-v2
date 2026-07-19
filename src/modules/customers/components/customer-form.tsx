"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Form } from "@/components/ui/form";
import {
  createCustomerAction,
  updateCustomerAction,
} from "@/modules/customers/actions/customer-actions";
import { CustomerAddressSection } from "@/modules/customers/components/customer-address-section";
import { CustomerContactSection } from "@/modules/customers/components/customer-contact-section";
import { CustomerCreditSection } from "@/modules/customers/components/customer-credit-section";
import { CustomerIdentitySection } from "@/modules/customers/components/customer-identity-section";
import { CustomerOpeningBalanceSection } from "@/modules/customers/components/customer-opening-balance-section";
import { CustomerTaxSection } from "@/modules/customers/components/customer-tax-section";
import {
  createCustomerSchema,
  type CreateCustomerInput,
} from "@/modules/customers/validation/customer-schema";
import type { CustomerWithLedger } from "@/types/customer";
import type { LedgerGroup } from "@/types/ledger-group";

const LIST_PATH = "/masters/customers";

interface CustomerFormProps {
  /** When present the form saves via update; otherwise it creates. Create
   * and Update share the same field set (26-customer-management.md) — one
   * component serves both screens, the established simplification. */
  customer?: CustomerWithLedger;
  /** Active "Sundry Debtors"-subtree groups (plus, on edit, the customer's
   * current group even if since deactivated). */
  groups: LedgerGroup[];
}

export function CustomerForm({ customer, groups }: CustomerFormProps) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const isEdit = customer !== undefined;
  const singleGroup = groups.length === 1 ? groups[0] : null;

  const form = useForm<CreateCustomerInput>({
    resolver: zodResolver(createCustomerSchema),
    defaultValues: {
      displayName: customer?.ledger.name ?? "",
      ledgerGroupId: customer?.ledger.ledgerGroupId ?? singleGroup?.id ?? "",
      customerType: customer?.customerType ?? "RETAIL",
      contactPerson: customer?.contactPerson ?? "",
      mobileNumber: customer?.mobileNumber ?? "",
      alternateMobile: customer?.alternateMobile ?? "",
      email: customer?.email ?? "",
      gstin: customer?.gstin ?? "",
      pan: customer?.pan ?? "",
      addressLine1: customer?.addressLine1 ?? "",
      addressLine2: customer?.addressLine2 ?? "",
      city: customer?.city ?? "",
      state: customer?.state ?? "",
      district: customer?.district ?? "",
      country: customer?.country ?? "India",
      pinCode: customer?.pinCode ?? "",
      creditLimit: customer?.creditLimit ?? undefined,
      creditDays: customer?.creditDays ?? undefined,
      // Debit is the debtor default; Credit stays selectable (advance
      // received) — 26-customer-management.md.
      openingBalance: customer?.ledger.openingBalance ?? 0,
      openingBalanceType: customer?.ledger.openingBalanceType ?? "DEBIT",
      description: customer?.ledger.description ?? "",
    },
  });

  async function handleSubmit(data: CreateCustomerInput) {
    setIsSubmitting(true);
    try {
      const result = isEdit
        ? await updateCustomerAction(customer.id, data)
        : await createCustomerAction(data);

      if (result.success) {
        toast.success(isEdit ? "Customer saved successfully." : "Customer created successfully.");
        router.push(LIST_PATH);
        router.refresh();
        return;
      }

      toast.error(
        result.error ?? (isEdit ? "Failed to save customer." : "Failed to create customer.")
      );
    } catch {
      // A Server Action can reject outright (network drop, server crash) —
      // surface it instead of silently re-enabling the button (the
      // warehouse-form.tsx defensive convention).
      toast.error(isEdit ? "Failed to save customer." : "Failed to create customer.");
    } finally {
      setIsSubmitting(false);
    }
  }

  if (groups.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-border p-6 text-sm text-muted-foreground">
        No &quot;Sundry Debtors&quot; ledger group was found for this company. Contact your
        administrator before creating a customer.
      </div>
    );
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleSubmit)} className="flex max-w-3xl flex-col gap-8">
        <CustomerIdentitySection control={form.control} groups={groups} />
        <CustomerContactSection control={form.control} />
        <CustomerTaxSection control={form.control} />
        <CustomerAddressSection control={form.control} />
        <CustomerCreditSection control={form.control} />
        <CustomerOpeningBalanceSection control={form.control} />

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
            {isSubmitting ? "Saving…" : isEdit ? "Save Changes" : "Create Customer"}
          </Button>
        </div>
      </form>
    </Form>
  );
}
