"use client";

import { CustomerForm } from "@/modules/customers/components/customer-form";
import type { CustomerWithLedger } from "@/types/customer";
import type { LedgerGroup } from "@/types/ledger-group";

interface CustomerEditFormProps {
  customer: CustomerWithLedger;
  groups: LedgerGroup[];
}

/**
 * Edit wrapper around CustomerForm — Create and Update share the same field
 * set (26-customer-management.md), so this only makes the customer prop
 * mandatory; it exists as the spec's named edit seam for the day edit
 * diverges (the product-edit-form.tsx convention).
 */
export function CustomerEditForm({ customer, groups }: CustomerEditFormProps) {
  return <CustomerForm customer={customer} groups={groups} />;
}
