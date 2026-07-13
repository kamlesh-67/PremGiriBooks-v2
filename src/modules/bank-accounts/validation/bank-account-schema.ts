import { z } from "zod";

const BALANCE_TYPES = ["DEBIT", "CREDIT"] as const;

export const BANK_ACCOUNT_TYPES = ["SAVINGS", "CURRENT", "CASH_CREDIT", "OVERDRAFT"] as const;

export const BANK_ACCOUNT_TYPE_LABELS: Record<(typeof BANK_ACCOUNT_TYPES)[number], string> = {
  SAVINGS: "Savings",
  CURRENT: "Current",
  CASH_CREDIT: "Cash Credit",
  OVERDRAFT: "Overdraft",
};

// Prisma's `Decimal(14, 2)` column: 12 integer digits + 2 decimal places.
const MAX_OPENING_BALANCE = 999999999999.99;

// Standard IFSC shape: 4 letters, a literal "0", then 6 alphanumeric
// characters. Case is normalized to uppercase by the service layer before
// storage, not here, so the regex stays case-insensitive.
const IFSC_REGEX = /^[A-Za-z]{4}0[A-Za-z0-9]{6}$/;

// Standard UPI VPA shape: name@handle.
const UPI_REGEX = /^[\w.-]{2,256}@[a-zA-Z]{2,64}$/;

const ACCOUNT_DISPLAY_NAME_SCHEMA = z
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

const BANK_NAME_SCHEMA = z
  .string()
  .trim()
  .min(2, "Bank name is required")
  .max(150, "Bank name must be at most 150 characters");

const BRANCH_NAME_SCHEMA = z
  .string()
  .trim()
  .min(2, "Branch name is required")
  .max(150, "Branch name must be at most 150 characters");

const ACCOUNT_HOLDER_NAME_SCHEMA = z
  .string()
  .trim()
  .min(2, "Account holder name is required")
  .max(150, "Account holder name must be at most 150 characters");

const ACCOUNT_NUMBER_SCHEMA = z
  .string()
  .trim()
  .min(4, "Account number must be at least 4 digits")
  .max(20, "Account number must be at most 20 digits")
  .regex(/^\d+$/, "Account number must contain digits only");

const IFSC_CODE_SCHEMA = z
  .string()
  .trim()
  .regex(IFSC_REGEX, "Enter a valid 11-character IFSC code (e.g. HDFC0001234).");

const UPI_ID_SCHEMA = z
  .string()
  .trim()
  .optional()
  .refine((value) => !value || UPI_REGEX.test(value), {
    message: "Enter a valid UPI ID (e.g. name@bank).",
  });

export const createBankAccountSchema = z.object({
  accountDisplayName: ACCOUNT_DISPLAY_NAME_SCHEMA,
  ledgerGroupId: z.uuid("Please select a ledger group."),
  bankName: BANK_NAME_SCHEMA,
  accountNumber: ACCOUNT_NUMBER_SCHEMA,
  ifscCode: IFSC_CODE_SCHEMA,
  branchName: BRANCH_NAME_SCHEMA,
  accountHolderName: ACCOUNT_HOLDER_NAME_SCHEMA,
  accountType: z.enum(BANK_ACCOUNT_TYPES),
  upiId: UPI_ID_SCHEMA,
  openingBalance: OPENING_BALANCE_SCHEMA,
  openingBalanceType: z.enum(BALANCE_TYPES),
  description: DESCRIPTION_SCHEMA,
});

export type CreateBankAccountInput = z.infer<typeof createBankAccountSchema>;

// ledgerGroupId is immutable once a Bank Account (and its underlying Ledger)
// is created — matches 14-ledger-master.md's identical rule for Ledger's own
// ledgerGroupId.
export const updateBankAccountSchema = z.object({
  accountDisplayName: ACCOUNT_DISPLAY_NAME_SCHEMA,
  bankName: BANK_NAME_SCHEMA,
  accountNumber: ACCOUNT_NUMBER_SCHEMA,
  ifscCode: IFSC_CODE_SCHEMA,
  branchName: BRANCH_NAME_SCHEMA,
  accountHolderName: ACCOUNT_HOLDER_NAME_SCHEMA,
  accountType: z.enum(BANK_ACCOUNT_TYPES),
  upiId: UPI_ID_SCHEMA,
  openingBalance: OPENING_BALANCE_SCHEMA,
  openingBalanceType: z.enum(BALANCE_TYPES),
  description: DESCRIPTION_SCHEMA,
});

export type UpdateBankAccountInput = z.infer<typeof updateBankAccountSchema>;
