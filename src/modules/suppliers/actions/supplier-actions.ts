"use server";

import { runAction } from "@/lib/run-action";
import { supplierService } from "@/modules/suppliers/services/supplier-service";
import type {
  CreateSupplierInput,
  UpdateSupplierInput,
} from "@/modules/suppliers/validation/supplier-schema";
import type { ActionResult } from "@/types/api";
import type { SupplierWithLedger } from "@/types/supplier";

const LIST_PATH = "/masters/suppliers";

// Every supplier write also touches its paired Ledger row, so the generic
// Ledgers screen is revalidated alongside the supplier list (the
// customer-actions.ts/bank-account-actions.ts convention).
const LEDGERS_PATH = "/accounting/ledgers";

export async function createSupplierAction(
  input: CreateSupplierInput
): Promise<ActionResult<SupplierWithLedger>> {
  return runAction(() => supplierService.createSupplier(input), [LIST_PATH, LEDGERS_PATH]);
}

export async function updateSupplierAction(
  id: string,
  input: UpdateSupplierInput
): Promise<ActionResult<SupplierWithLedger>> {
  return runAction(() => supplierService.updateSupplier(id, input), [
    LIST_PATH,
    LEDGERS_PATH,
    `/masters/suppliers/${id}/edit`,
  ]);
}

export async function activateSupplierAction(
  id: string
): Promise<ActionResult<SupplierWithLedger>> {
  return runAction(() => supplierService.activateSupplier(id), [LIST_PATH, LEDGERS_PATH]);
}

export async function deactivateSupplierAction(
  id: string
): Promise<ActionResult<SupplierWithLedger>> {
  return runAction(() => supplierService.deactivateSupplier(id), [LIST_PATH, LEDGERS_PATH]);
}
