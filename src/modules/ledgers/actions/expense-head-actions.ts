"use server";

import { runAction } from "@/lib/run-action";
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
// /accounting/ledgers is also revalidated throughout, since every expense
// head equally appears in the generic Ledger list.

const LIST_PATHS = ["/accounting/expense-heads", "/accounting/ledgers"] as const;

export async function createExpenseHeadAction(
  input: CreateLedgerInput
): Promise<ActionResult<Ledger>> {
  return runAction(() => ledgerService.createExpenseHead(input), LIST_PATHS);
}

export async function updateExpenseHeadAction(
  id: string,
  input: UpdateLedgerInput
): Promise<ActionResult<Ledger>> {
  return runAction(() => ledgerService.updateLedger(id, input), [
    ...LIST_PATHS,
    `/accounting/expense-heads/${id}/edit`,
  ]);
}

export async function activateExpenseHeadAction(id: string): Promise<ActionResult<Ledger>> {
  return runAction(() => ledgerService.activateLedger(id), LIST_PATHS);
}

export async function deactivateExpenseHeadAction(id: string): Promise<ActionResult<Ledger>> {
  return runAction(() => ledgerService.deactivateLedger(id), LIST_PATHS);
}
