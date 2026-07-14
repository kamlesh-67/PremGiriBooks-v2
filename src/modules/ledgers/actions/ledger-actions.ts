"use server";

import { runLedgerAction } from "@/modules/ledgers/actions/run-ledger-action";
import { ledgerService } from "@/modules/ledgers/services/ledger-service";
import type { CreateLedgerInput, UpdateLedgerInput } from "@/modules/ledgers/validation/ledger-schema";
import type { ActionResult } from "@/types/api";
import type { Ledger } from "@/types/ledger";

const LIST_PATH = "/accounting/ledgers";

export async function createLedgerAction(input: CreateLedgerInput): Promise<ActionResult<Ledger>> {
  return runLedgerAction(() => ledgerService.createLedger(input), [LIST_PATH]);
}

export async function updateLedgerAction(
  id: string,
  input: UpdateLedgerInput
): Promise<ActionResult<Ledger>> {
  return runLedgerAction(() => ledgerService.updateLedger(id, input), [
    LIST_PATH,
    `/accounting/ledgers/${id}/edit`,
  ]);
}

export async function activateLedgerAction(id: string): Promise<ActionResult<Ledger>> {
  return runLedgerAction(() => ledgerService.activateLedger(id), [LIST_PATH]);
}

export async function deactivateLedgerAction(id: string): Promise<ActionResult<Ledger>> {
  return runLedgerAction(() => ledgerService.deactivateLedger(id), [LIST_PATH]);
}
