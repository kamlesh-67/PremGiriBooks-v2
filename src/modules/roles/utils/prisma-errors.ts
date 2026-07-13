import { Prisma } from "@prisma/client";

const RECORD_NOT_FOUND_ERROR_CODE = "P2025";
const UNIQUE_CONSTRAINT_ERROR_CODE = "P2002";
const WRITE_CONFLICT_ERROR_CODE = "P2034";

export function isRecordNotFoundError(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === RECORD_NOT_FOUND_ERROR_CODE
  );
}

export function isUniqueConstraintError(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === UNIQUE_CONSTRAINT_ERROR_CODE
  );
}

/**
 * True only for a Serializable write conflict (P2034) — deliberately does
 * NOT treat P2002 as retryable, since P2002 here means a genuine role-name
 * uniqueness violation (a real business error to surface, not a transient
 * concurrency conflict to silently retry past), mirroring
 * modules/users/utils/prisma-errors.ts's identical reasoning.
 */
export function isRetryableTransactionError(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === WRITE_CONFLICT_ERROR_CODE
  );
}
