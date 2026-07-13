"use server";

import { revalidatePath } from "next/cache";

import { toActionErrorMessage } from "@/lib/action-error";
import { ledgerGroupService } from "@/modules/ledger-groups/services/ledger-group-service";
import type {
  CreateLedgerGroupInput,
  UpdateLedgerGroupInput,
} from "@/modules/ledger-groups/validation/ledger-group-schema";
import type { ActionResult } from "@/types/api";
import type { LedgerGroup } from "@/types/ledger-group";

export async function createLedgerGroupAction(
  input: CreateLedgerGroupInput
): Promise<ActionResult<LedgerGroup>> {
  try {
    const ledgerGroup = await ledgerGroupService.createLedgerGroup(input);
    revalidatePath("/accounting/ledger-groups");
    return { success: true, data: ledgerGroup };
  } catch (error) {
    return { success: false, error: toActionErrorMessage(error) };
  }
}

export async function updateLedgerGroupAction(
  id: string,
  input: UpdateLedgerGroupInput
): Promise<ActionResult<LedgerGroup>> {
  try {
    const ledgerGroup = await ledgerGroupService.updateLedgerGroup(id, input);
    revalidatePath("/accounting/ledger-groups");
    revalidatePath(`/accounting/ledger-groups/${id}/edit`);
    return { success: true, data: ledgerGroup };
  } catch (error) {
    return { success: false, error: toActionErrorMessage(error) };
  }
}

export async function activateLedgerGroupAction(id: string): Promise<ActionResult<LedgerGroup>> {
  try {
    const ledgerGroup = await ledgerGroupService.activateLedgerGroup(id);
    revalidatePath("/accounting/ledger-groups");
    return { success: true, data: ledgerGroup };
  } catch (error) {
    return { success: false, error: toActionErrorMessage(error) };
  }
}

export async function deactivateLedgerGroupAction(id: string): Promise<ActionResult<LedgerGroup>> {
  try {
    const ledgerGroup = await ledgerGroupService.deactivateLedgerGroup(id);
    revalidatePath("/accounting/ledger-groups");
    return { success: true, data: ledgerGroup };
  } catch (error) {
    return { success: false, error: toActionErrorMessage(error) };
  }
}
