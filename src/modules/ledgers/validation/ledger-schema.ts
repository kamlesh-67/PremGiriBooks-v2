import { z } from "zod";

const BALANCE_TYPES = ["DEBIT", "CREDIT"] as const;

// Prisma's `Decimal(14, 2)` column: 12 integer digits + 2 decimal places.
const MAX_OPENING_BALANCE = 999999999999.99;

const NAME_SCHEMA = z
  .string()
  .trim()
  .min(2, "Name must be at least 2 characters")
  .max(100, "Name must be at most 100 characters");

const DESCRIPTION_SCHEMA = z
  .string()
  .trim()
  .max(500, "Description must be at most 500 characters")
  .optional();

const OPENING_BALANCE_SCHEMA = z
  .number()
  .min(0, "Opening balance must be zero or greater")
  .max(MAX_OPENING_BALANCE, "Opening balance is too large");

export const createLedgerSchema = z.object({
  name: NAME_SCHEMA,
  ledgerGroupId: z.uuid("Please select a ledger group."),
  openingBalance: OPENING_BALANCE_SCHEMA,
  openingBalanceType: z.enum(BALANCE_TYPES),
  description: DESCRIPTION_SCHEMA,
});

export type CreateLedgerInput = z.infer<typeof createLedgerSchema>;

// Edit only ever changes name, opening balance/type, and description —
// ledgerGroupId is immutable once a Ledger is created (14-ledger-master.md).
export const updateLedgerSchema = z.object({
  name: NAME_SCHEMA,
  openingBalance: OPENING_BALANCE_SCHEMA,
  openingBalanceType: z.enum(BALANCE_TYPES),
  description: DESCRIPTION_SCHEMA,
});

export type UpdateLedgerInput = z.infer<typeof updateLedgerSchema>;
