"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Form } from "@/components/ui/form";
import {
  createSupplierAction,
  updateSupplierAction,
} from "@/modules/suppliers/actions/supplier-actions";
import { SupplierAddressSection } from "@/modules/suppliers/components/supplier-address-section";
import { SupplierContactSection } from "@/modules/suppliers/components/supplier-contact-section";
import { SupplierCreditSection } from "@/modules/suppliers/components/supplier-credit-section";
import { SupplierIdentitySection } from "@/modules/suppliers/components/supplier-identity-section";
import { SupplierOpeningBalanceSection } from "@/modules/suppliers/components/supplier-opening-balance-section";
import { SupplierTaxSection } from "@/modules/suppliers/components/supplier-tax-section";
import {
  createSupplierSchema,
  type CreateSupplierInput,
} from "@/modules/suppliers/validation/supplier-schema";
import type { SupplierWithLedger } from "@/types/supplier";
import type { LedgerGroup } from "@/types/ledger-group";

const LIST_PATH = "/masters/suppliers";

interface SupplierFormProps {
  /** When present the form saves via update; otherwise it creates. Create
   * and Update share the same field set (27-supplier-management.md) — one
   * component serves both screens, mirroring customer-form.tsx. */
  supplier?: SupplierWithLedger;
  /** Active "Sundry Creditors"-subtree groups (plus, on edit, the supplier's
   * current group even if since deactivated). */
  groups: LedgerGroup[];
}

export function SupplierForm({ supplier, groups }: SupplierFormProps) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const isEdit = supplier !== undefined;
  const singleGroup = groups.length === 1 ? groups[0] : null;

  const form = useForm<CreateSupplierInput>({
    resolver: zodResolver(createSupplierSchema),
    defaultValues: {
      displayName: supplier?.ledger.name ?? "",
      ledgerGroupId: supplier?.ledger.ledgerGroupId ?? singleGroup?.id ?? "",
      contactPerson: supplier?.contactPerson ?? "",
      mobileNumber: supplier?.mobileNumber ?? "",
      alternateMobile: supplier?.alternateMobile ?? "",
      email: supplier?.email ?? "",
      gstin: supplier?.gstin ?? "",
      pan: supplier?.pan ?? "",
      addressLine1: supplier?.addressLine1 ?? "",
      addressLine2: supplier?.addressLine2 ?? "",
      city: supplier?.city ?? "",
      state: supplier?.state ?? "",
      district: supplier?.district ?? "",
      country: supplier?.country ?? "India",
      pinCode: supplier?.pinCode ?? "",
      creditDays: supplier?.creditDays ?? undefined,
      // Credit is the creditor default; Debit stays selectable (advance
      // paid) — 27-supplier-management.md.
      openingBalance: supplier?.ledger.openingBalance ?? 0,
      openingBalanceType: supplier?.ledger.openingBalanceType ?? "CREDIT",
      description: supplier?.ledger.description ?? "",
    },
  });

  async function handleSubmit(data: CreateSupplierInput) {
    setIsSubmitting(true);
    try {
      const result = isEdit
        ? await updateSupplierAction(supplier.id, data)
        : await createSupplierAction(data);

      if (result.success) {
        toast.success(isEdit ? "Supplier saved successfully." : "Supplier created successfully.");
        router.push(LIST_PATH);
        router.refresh();
        return;
      }

      toast.error(
        result.error ?? (isEdit ? "Failed to save supplier." : "Failed to create supplier.")
      );
    } catch {
      // A Server Action can reject outright (network drop, server crash) —
      // surface it instead of silently re-enabling the button (the
      // customer-form.tsx defensive convention).
      toast.error(isEdit ? "Failed to save supplier." : "Failed to create supplier.");
    } finally {
      setIsSubmitting(false);
    }
  }

  if (groups.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-border p-6 text-sm text-muted-foreground">
        No &quot;Sundry Creditors&quot; ledger group was found for this company. Contact your
        administrator before creating a supplier.
      </div>
    );
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleSubmit)} className="flex max-w-3xl flex-col gap-8">
        <SupplierIdentitySection control={form.control} groups={groups} />
        <SupplierContactSection control={form.control} />
        <SupplierTaxSection control={form.control} />
        <SupplierAddressSection control={form.control} />
        <SupplierCreditSection control={form.control} />
        <SupplierOpeningBalanceSection control={form.control} />

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
            {isSubmitting ? "Saving…" : isEdit ? "Save Changes" : "Create Supplier"}
          </Button>
        </div>
      </form>
    </Form>
  );
}
