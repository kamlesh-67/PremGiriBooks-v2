import { Prisma } from "@prisma/client";

const RECORD_NOT_FOUND_ERROR_CODE = "P2025";
const UNIQUE_CONSTRAINT_ERROR_CODE = "P2002";
const WRITE_CONFLICT_ERROR_CODE = "P2034";

/**
 * Shared Prisma error classifiers, extracted from the identical per-module
 * copies the units/ledgers/ledger-groups modules each carried (the same
 * promotion pattern as src/lib/run-action.ts).
 *
 * Deliberately NOT adopted (yet) by the modules whose local helpers differ
 * in shape or semantics: financial-year (its isRetryableTransactionError
 * treats P2002 as retryable because of its hand-written partial unique
 * index), users/bank-accounts (they expose their own meta.target extraction
 * helpers), company and roles (untouched to keep the extraction scoped) —
 * consolidate those only when a change touches them anyway.
 */

export function isRecordNotFoundError(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === RECORD_NOT_FOUND_ERROR_CODE
  );
}

/**
 * Optionally narrowed to a specific column for models with more than one
 * unique constraint (e.g. Unit's per-company name and symbol), so callers
 * can produce a field-specific friendly message. Prisma reports the violated
 * constraint's columns in `meta.target`.
 */
export function isUniqueConstraintError(error: unknown, column?: string): boolean {
  if (
    !(error instanceof Prisma.PrismaClientKnownRequestError) ||
    error.code !== UNIQUE_CONSTRAINT_ERROR_CODE
  ) {
    return false;
  }
  if (!column) {
    return true;
  }
  const target = error.meta?.target;
  return Array.isArray(target) && target.includes(column);
}

/**
 * True only for a Serializable write conflict (P2034) — deliberately does
 * NOT treat P2002 as retryable, since P2002 means a genuine uniqueness
 * violation (a real business error to surface immediately, not a transient
 * concurrency conflict to silently retry past). A module whose unique
 * constraints CAN surface transiently under concurrency (financial-year's
 * hand-written partial unique index on isCurrent) keeps its own wider
 * helper instead of using this one.
 */
export function isRetryableTransactionError(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === WRITE_CONFLICT_ERROR_CODE
  );
}
