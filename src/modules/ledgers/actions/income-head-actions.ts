"use server";

import { runAction } from "@/lib/run-action";
import { ledgerService } from "@/modules/ledgers/services/ledger-service";
import type { CreateLedgerInput, UpdateLedgerInput } from "@/modules/ledgers/validation/ledger-schema";
import type { ActionResult } from "@/types/api";
import type { Ledger } from "@/types/ledger";

// Income Heads (17-income-heads.md) — the scoped Server Action layer over
// the same Ledger operations ledger-actions.ts exposes, mirroring
// expense-head-actions.ts on the income side. Only Create has an extra
// business rule (the income-subtree validation in
// ledgerService.createIncomeHead); Edit/Activate/Deactivate delegate to the
// identical generic service methods and exist here only so the Income Heads
// screens revalidate their own routes instead of /accounting/ledgers.
// /accounting/ledgers is also revalidated throughout, since every income
// head equally appears in the generic Ledger list.

const LIST_PATHS = ["/accounting/income-heads", "/accounting/ledgers"] as const;

export async function createIncomeHeadAction(
  input: CreateLedgerInput
): Promise<ActionResult<Ledger>> {
  return runAction(() => ledgerService.createIncomeHead(input), LIST_PATHS);
}

export async function updateIncomeHeadAction(
  id: string,
  input: UpdateLedgerInput
): Promise<ActionResult<Ledger>> {
  return runAction(() => ledgerService.updateLedger(id, input), [
    ...LIST_PATHS,
    `/accounting/income-heads/${id}/edit`,
  ]);
}

export async function activateIncomeHeadAction(id: string): Promise<ActionResult<Ledger>> {
  return runAction(() => ledgerService.activateLedger(id), LIST_PATHS);
}

export async function deactivateIncomeHeadAction(id: string): Promise<ActionResult<Ledger>> {
  return runAction(() => ledgerService.deactivateLedger(id), LIST_PATHS);
}
