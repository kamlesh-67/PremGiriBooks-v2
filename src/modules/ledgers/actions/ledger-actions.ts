"use server";

import { revalidatePath } from "next/cache";

import { toActionErrorMessage } from "@/lib/action-error";
import { ledgerService } from "@/modules/ledgers/services/ledger-service";
import type { CreateLedgerInput, UpdateLedgerInput } from "@/modules/ledgers/validation/ledger-schema";
import type { ActionResult } from "@/types/api";
import type { Ledger } from "@/types/ledger";

export async function createLedgerAction(input: CreateLedgerInput): Promise<ActionResult<Ledger>> {
  try {
    const ledger = await ledgerService.createLedger(input);
    revalidatePath("/accounting/ledgers");
    return { success: true, data: ledger };
  } catch (error) {
    return { success: false, error: toActionErrorMessage(error) };
  }
}

export async function updateLedgerAction(
  id: string,
  input: UpdateLedgerInput
): Promise<ActionResult<Ledger>> {
  try {
    const ledger = await ledgerService.updateLedger(id, input);
    revalidatePath("/accounting/ledgers");
    revalidatePath(`/accounting/ledgers/${id}/edit`);
    return { success: true, data: ledger };
  } catch (error) {
    return { success: false, error: toActionErrorMessage(error) };
  }
}

export async function activateLedgerAction(id: string): Promise<ActionResult<Ledger>> {
  try {
    const ledger = await ledgerService.activateLedger(id);
    revalidatePath("/accounting/ledgers");
    return { success: true, data: ledger };
  } catch (error) {
    return { success: false, error: toActionErrorMessage(error) };
  }
}

export async function deactivateLedgerAction(id: string): Promise<ActionResult<Ledger>> {
  try {
    const ledger = await ledgerService.deactivateLedger(id);
    revalidatePath("/accounting/ledgers");
    return { success: true, data: ledger };
  } catch (error) {
    return { success: false, error: toActionErrorMessage(error) };
  }
}
