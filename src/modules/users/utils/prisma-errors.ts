import { Prisma } from "@prisma/client";

const UNIQUE_CONSTRAINT_ERROR_CODE = "P2002";
const WRITE_CONFLICT_ERROR_CODE = "P2034";

export function getUniqueConstraintFields(error: unknown): string[] {
  if (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === UNIQUE_CONSTRAINT_ERROR_CODE
  ) {
    const target = error.meta?.["target"];
    if (Array.isArray(target)) {
      return target.filter((value): value is string => typeof value === "string");
    }
  }

  return [];
}

/**
 * True only for a Serializable write conflict (P2034) — deliberately does
 * NOT treat P2002 as retryable the way financial-year's equivalent helper
 * does, since P2002 here means a genuine username/email uniqueness
 * violation (a real business error to surface, not a transient concurrency
 * conflict to silently retry and swallow).
 */
export function isRetryableTransactionError(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === WRITE_CONFLICT_ERROR_CODE
  );
}
