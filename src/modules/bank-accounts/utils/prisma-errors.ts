import { Prisma } from "@prisma/client";

const RECORD_NOT_FOUND_ERROR_CODE = "P2025";
const UNIQUE_CONSTRAINT_ERROR_CODE = "P2002";

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

// A Bank Account create/update can violate either of two distinct unique
// constraints in the same transaction — the underlying Ledger's
// [companyId, name] or the BankAccount's own [companyId, accountNumber] —
// so the generic isUniqueConstraintError() check alone isn't enough to give
// a specific, correct error message. Inspects Prisma's error metadata to
// tell them apart.
export function getUniqueConstraintTarget(error: unknown): string[] {
  if (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === UNIQUE_CONSTRAINT_ERROR_CODE &&
    Array.isArray(error.meta?.target)
  ) {
    return error.meta.target as string[];
  }
  return [];
}
