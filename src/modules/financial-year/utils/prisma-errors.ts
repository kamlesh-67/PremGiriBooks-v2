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

/**
 * True for the two failure modes a concurrent setCurrent/closeFinancialYear
 * transaction can hit: a Serializable write conflict (P2034) or a violation
 * of the hand-written partial unique index on isCurrent (surfaces as P2002
 * since Prisma maps the underlying Postgres 23505 code generically, even for
 * indexes not declared in schema.prisma).
 */
export function isRetryableTransactionError(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    (error.code === WRITE_CONFLICT_ERROR_CODE || error.code === UNIQUE_CONSTRAINT_ERROR_CODE)
  );
}
