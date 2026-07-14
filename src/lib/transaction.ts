import type { Prisma } from "@prisma/client";

import { AppError } from "@/lib/app-error";
import { prisma } from "@/lib/prisma";

const MAX_TRANSACTION_RETRIES = 3;
const BASE_RETRY_DELAY_MS = 20;
const DEFAULT_CONFLICT_MESSAGE = "This record was changed by another request. Please try again.";

export interface RunInTransactionOptions {
  isolationLevel?: Prisma.TransactionIsolationLevel;
  /** When provided, a failed attempt is retried (up to MAX_TRANSACTION_RETRIES) whenever this returns true. */
  retryable?: (error: unknown) => boolean;
  conflictMessage?: string;
  /** Called before each retried attempt (not the first) — for callers that want to log contention. */
  onRetry?: (attempt: number, maxAttempts: number) => void;
  /** Called once, in place of onRetry, when the final attempt still failed retryably. */
  onRetriesExhausted?: (attempt: number, maxAttempts: number) => void;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Single entry point for every `prisma.$transaction` call in the app
 * (Architecture Improvement Recommendations, Priority 1 #4 — Shared
 * Transaction Manager). Replaces the previously duplicated
 * `withRetry(() => prisma.$transaction(fn, SERIALIZABLE), isRetryable,
 * message)` boilerplate that had accumulated independently across
 * role-repository.ts, permission-repository.ts, user-repository.ts,
 * financial-year-repository.ts, and platform-user-service.ts. Retry is
 * opt-in via `retryable` — omitting it (as most call sites do) runs the
 * callback exactly once, matching the plain `prisma.$transaction(fn)` calls
 * this also replaces.
 */
export async function runInTransaction<T>(
  fn: (tx: Prisma.TransactionClient) => Promise<T>,
  options: RunInTransactionOptions = {}
): Promise<T> {
  const { isolationLevel, retryable, conflictMessage, onRetry, onRetriesExhausted } = options;
  const txOptions = isolationLevel ? { isolationLevel } : undefined;

  if (!retryable) {
    return prisma.$transaction(fn, txOptions);
  }

  for (let attempt = 1; attempt <= MAX_TRANSACTION_RETRIES; attempt += 1) {
    try {
      return await prisma.$transaction(fn, txOptions);
    } catch (error) {
      if (!retryable(error)) {
        throw error;
      }
      if (attempt === MAX_TRANSACTION_RETRIES) {
        onRetriesExhausted?.(attempt, MAX_TRANSACTION_RETRIES);
        throw new AppError(conflictMessage ?? DEFAULT_CONFLICT_MESSAGE);
      }
      onRetry?.(attempt, MAX_TRANSACTION_RETRIES);
      await delay(BASE_RETRY_DELAY_MS * attempt + Math.random() * BASE_RETRY_DELAY_MS);
    }
  }

  throw new AppError(conflictMessage ?? DEFAULT_CONFLICT_MESSAGE);
}
