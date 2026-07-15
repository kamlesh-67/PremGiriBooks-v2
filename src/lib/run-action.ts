import { revalidatePath } from "next/cache";

import { toActionErrorMessage } from "@/lib/action-error";
import { logger } from "@/lib/logger";
import type { ActionResult } from "@/types/api";

/**
 * Shared wrapper for Server Actions: runs the service operation, revalidates
 * the given routes on success, and translates any error through the standard
 * toActionErrorMessage envelope. Lives outside the "use server" files because
 * those may only export async Server Actions, not helpers.
 *
 * Originally src/modules/ledgers/actions/run-ledger-action.ts (16-expense-heads.md
 * review fixes); promoted here by 19-unit-management.md so modules other than
 * ledgers can share it without a cross-module import.
 *
 * Only operation() failures are reported as failures. Once the operation has
 * committed, a revalidatePath() throw must not mark the action failed — the
 * mutation already persisted, and reporting failure would invite a "retry"
 * of work that succeeded. It is logged server-side instead; the affected
 * screens simply serve cached data until their next natural revalidation.
 */
export async function runAction<T>(
  operation: () => Promise<T>,
  revalidatePaths: readonly string[]
): Promise<ActionResult<T>> {
  let data: T;
  try {
    data = await operation();
  } catch (error) {
    return { success: false, error: toActionErrorMessage(error) };
  }

  for (const path of revalidatePaths) {
    try {
      revalidatePath(path);
    } catch (error) {
      logger.warn({ err: error, path }, "revalidatePath failed after a committed action");
    }
  }

  return { success: true, data };
}
