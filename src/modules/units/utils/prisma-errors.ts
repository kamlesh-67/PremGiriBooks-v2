import { Prisma } from "@prisma/client";

const RECORD_NOT_FOUND_ERROR_CODE = "P2025";
const UNIQUE_CONSTRAINT_ERROR_CODE = "P2002";

export function isRecordNotFoundError(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === RECORD_NOT_FOUND_ERROR_CODE
  );
}

/**
 * Like the ledgers/ledger-groups modules' identical helpers, but optionally
 * narrowed to a specific column — Unit has TWO per-company unique
 * constraints (name, symbol) and the service needs a field-specific friendly
 * message for each (19-unit-management.md). Prisma reports the violated
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
