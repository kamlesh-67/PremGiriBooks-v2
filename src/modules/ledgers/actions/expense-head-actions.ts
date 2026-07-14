"use server";

import { revalidatePath } from "next/cache";

import { toActionErrorMessage } from "@/lib/action-error";
import { ledgerService } from "@/modules/ledgers/services/ledger-service";
import type { CreateLedgerInput, UpdateLedgerInput } from "@/modules/ledgers/validation/ledger-schema";
import type { ActionResult } from "@/types/api";
import type { Ledger } from "@/types/ledger";

// Expense Heads (16-expense-heads.md) — the scoped Server Action layer over
// the same Ledger operations ledger-actions.ts exposes. Only Create has an
// extra business rule (the expense-subtree validation in
// ledgerService.createExpenseHead); Edit/Activate/Deactivate delegate to the
// identical generic service methods and exist here only so the Expense Heads
// screens revalidate their own routes instead of /accounting/ledgers.

export async function createExpenseHeadAction(
  input: CreateLedgerInput
): Promise<ActionResult<Ledger>> {
  try {
    const ledger = await ledgerService.createExpenseHead(input);
    revalidatePath("/accounting/expense-heads");
    revalidatePath("/accounting/ledgers");
    return { success: true, data: ledger };
  } catch (error) {
    return { success: false, error: toActionErrorMessage(error) };
  }
}

export async function updateExpenseHeadAction(
  id: string,
  input: UpdateLedgerInput
): Promise<ActionResult<Ledger>> {
  try {
    const ledger = await ledgerService.updateLedger(id, input);
    revalidatePath("/accounting/expense-heads");
    revalidatePath(`/accounting/expense-heads/${id}/edit`);
    revalidatePath("/accounting/ledgers");
    return { success: true, data: ledger };
  } catch (error) {
    return { success: false, error: toActionErrorMessage(error) };
  }
}

export async function activateExpenseHeadAction(id: string): Promise<ActionResult<Ledger>> {
  try {
    const ledger = await ledgerService.activateLedger(id);
    revalidatePath("/accounting/expense-heads");
    revalidatePath("/accounting/ledgers");
    return { success: true, data: ledger };
  } catch (error) {
    return { success: false, error: toActionErrorMessage(error) };
  }
}

export async function deactivateExpenseHeadAction(id: string): Promise<ActionResult<Ledger>> {
  try {
    const ledger = await ledgerService.deactivateLedger(id);
    revalidatePath("/accounting/expense-heads");
    revalidatePath("/accounting/ledgers");
    return { success: true, data: ledger };
  } catch (error) {
    return { success: false, error: toActionErrorMessage(error) };
  }
}
