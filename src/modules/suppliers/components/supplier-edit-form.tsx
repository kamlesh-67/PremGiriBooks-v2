"use client";

import { SupplierForm } from "@/modules/suppliers/components/supplier-form";
import type { SupplierWithLedger } from "@/types/supplier";
import type { LedgerGroup } from "@/types/ledger-group";

interface SupplierEditFormProps {
  supplier: SupplierWithLedger;
  groups: LedgerGroup[];
}

/**
 * Edit wrapper around SupplierForm — Create and Update share the same field
 * set (27-supplier-management.md), so this only makes the supplier prop
 * mandatory; it exists as the spec's named edit seam for the day edit
 * diverges (the customer-edit-form.tsx convention).
 */
export function SupplierEditForm({ supplier, groups }: SupplierEditFormProps) {
  return <SupplierForm supplier={supplier} groups={groups} />;
}
