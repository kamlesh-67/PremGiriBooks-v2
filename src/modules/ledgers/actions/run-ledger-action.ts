import { revalidatePath } from "next/cache";

import { toActionErrorMessage } from "@/lib/action-error";
import type { ActionResult } from "@/types/api";

/**
 * Shared wrapper for the Ledger-family Server Actions (ledger-actions.ts,
 * expense-head-actions.ts): runs the service operation, revalidates the given
 * routes on success, and translates any error through the standard
 * toActionErrorMessage envelope. Lives outside the "use server" files because
 * those may only export async Server Actions, not helpers.
 */
export async function runLedgerAction<T>(
  operation: () => Promise<T>,
  revalidatePaths: readonly string[]
): Promise<ActionResult<T>> {
  try {
    const data = await operation();
    for (const path of revalidatePaths) {
      revalidatePath(path);
    }
    return { success: true, data };
  } catch (error) {
    return { success: false, error: toActionErrorMessage(error) };
  }
}
