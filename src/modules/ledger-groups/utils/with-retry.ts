import { AppError } from "@/lib/app-error";
import { isRetryableTransactionError } from "@/modules/ledger-groups/utils/prisma-errors";

const MAX_TRANSACTION_RETRIES = 3;
const BASE_RETRY_DELAY_MS = 20;
const CONFLICT_MESSAGE = "This ledger group was changed by another request. Please try again.";

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Guards deactivateLedgerGroup's "no active child group" count-then-write
 * check — mirrors modules/roles/utils/with-retry.ts's identical Serializable
 * retry recipe. Waits a small, jittered, linearly-increasing delay between
 * retries so two conflicting transactions don't immediately collide again.
 */
export async function withRetry<T>(operation: () => Promise<T>): Promise<T> {
  for (let attempt = 1; attempt <= MAX_TRANSACTION_RETRIES; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      if (!isRetryableTransactionError(error) || attempt === MAX_TRANSACTION_RETRIES) {
        if (isRetryableTransactionError(error)) {
          throw new AppError(CONFLICT_MESSAGE);
        }
        throw error;
      }
      await delay(BASE_RETRY_DELAY_MS * attempt + Math.random() * BASE_RETRY_DELAY_MS);
    }
  }

  throw new AppError(CONFLICT_MESSAGE);
}
