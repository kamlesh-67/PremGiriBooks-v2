const MAX_TRANSACTION_RETRIES = 3;

/**
 * Shared by role-repository.ts and permission-repository.ts — both wrap a
 * Serializable-isolation transaction that enforces an "at least one active
 * Administrator-capable role must remain" invariant (mirroring the
 * financial-year/user modules' identical withRetry pattern for their own
 * count-then-write invariants). Kept as one helper here, unlike those
 * modules, since both call sites live in this same module.
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
          throw new Error(conflictMessage);
        }
        throw error;
      }
    }
  }

  throw new Error(conflictMessage);
}
