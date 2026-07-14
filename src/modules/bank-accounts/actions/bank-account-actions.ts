"use server";

import { revalidatePath } from "next/cache";

import { toActionErrorMessage } from "@/lib/action-error";
import { bankAccountService } from "@/modules/bank-accounts/services/bank-account-service";
import type {
  CreateBankAccountInput,
  UpdateBankAccountInput,
} from "@/modules/bank-accounts/validation/bank-account-schema";
import type { ActionResult } from "@/types/api";
import type { BankAccountWithLedger } from "@/types/bank-account";

function revalidateBankAccountPaths(id?: string) {
  revalidatePath("/accounting/banks");
  revalidatePath("/accounting/ledgers");
  if (id) {
    revalidatePath(`/accounting/banks/${id}/edit`);
  }
}

export async function createBankAccountAction(
  input: CreateBankAccountInput
): Promise<ActionResult<BankAccountWithLedger>> {
  try {
    const bankAccount = await bankAccountService.createBankAccount(input);
    revalidateBankAccountPaths();
    return { success: true, data: bankAccount };
  } catch (error) {
    return { success: false, error: toActionErrorMessage(error) };
  }
}

export async function updateBankAccountAction(
  id: string,
  input: UpdateBankAccountInput
): Promise<ActionResult<BankAccountWithLedger>> {
  try {
    const bankAccount = await bankAccountService.updateBankAccount(id, input);
    revalidateBankAccountPaths(id);
    return { success: true, data: bankAccount };
  } catch (error) {
    return { success: false, error: toActionErrorMessage(error) };
  }
}

export async function activateBankAccountAction(
  id: string
): Promise<ActionResult<BankAccountWithLedger>> {
  try {
    const bankAccount = await bankAccountService.activateBankAccount(id);
    revalidateBankAccountPaths();
    return { success: true, data: bankAccount };
  } catch (error) {
    return { success: false, error: toActionErrorMessage(error) };
  }
}

export async function deactivateBankAccountAction(
  id: string
): Promise<ActionResult<BankAccountWithLedger>> {
  try {
    const bankAccount = await bankAccountService.deactivateBankAccount(id);
    revalidateBankAccountPaths();
    return { success: true, data: bankAccount };
  } catch (error) {
    return { success: false, error: toActionErrorMessage(error) };
  }
}
