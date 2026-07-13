import { AppError } from "@/lib/app-error";

const MAX_TRANSACTION_RETRIES = 3;
const BASE_RETRY_DELAY_MS = 20;

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Shared by role-repository.ts and permission-repository.ts — both wrap a
 * Serializable-isolation transaction that enforces an "at least one active
 * Administrator-capable role must remain" invariant (mirroring the
 * financial-year/user modules' identical withRetry pattern for their own
 * count-then-write invariants). Kept as one helper here, unlike those
 * modules, since both call sites live in this same module.
 *
 * Waits a small, jittered, linearly-increasing delay between retries (only
 * when another attempt remains) so two conflicting transactions don't
 * immediately collide again on their very next attempt.
 */
export async function withRetry<T>(
  operation: () => Promise<T>,
  isRetryable: (error: unknown) => boolean,
  conflictMessage: string
): Promise<T> {
  for (let attempt = 1; attempt <= MAX_TRANSACTION_RETRIES; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      if (!isRetryable(error) || attempt === MAX_TRANSACTION_RETRIES) {
        if (isRetryable(error)) {
          throw new AppError(conflictMessage);
        }
        throw error;
      }
      await delay(BASE_RETRY_DELAY_MS * attempt + Math.random() * BASE_RETRY_DELAY_MS);
    }
  }

  throw new AppError(conflictMessage);
}
