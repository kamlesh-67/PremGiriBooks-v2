import { z } from "zod";

import {
  EMAIL_REGEX,
  GSTIN_REGEX,
  MOBILE_REGEX,
  PAN_REGEX,
  PIN_CODE_REGEX,
} from "@/lib/validation-patterns";

const BALANCE_TYPES = ["DEBIT", "CREDIT"] as const;

// Plain string-literal tuple so the client form never imports the Prisma
// runtime — the HSN_CODE_TYPES/PRODUCT_TYPE_VALUES convention. The Pricing
// Engine (#28) will key on this tier; the master only stores it.
export const CUSTOMER_TYPE_VALUES = ["RETAIL", "WHOLESALE", "DEALER", "DISTRIBUTOR"] as const;

// Prisma's `Decimal(14, 2)` columns: 12 integer digits + 2 decimal places.
const MAX_AMOUNT = 999999999999.99;

const MAX_CREDIT_DAYS = 365;

// Same scaled-with-tolerance float check as gst-rate-schema.ts /
// product-schema.ts (18.15 * 100 === 1814.9999… in binary floats).
function hasAtMostTwoDecimals(value: number): boolean {
  return Math.abs(value * 100 - Math.round(value * 100)) < 1e-6;
}

// Every blank optional string normalizes to undefined (the established
// convention since product-schema.ts's barcode/description fields), so
// clearing a field persists NULL.
const blankToUndefined = (value: string) => (value === "" ? undefined : value);

function optionalText(max: number, label: string) {
  return z
    .string()
    .trim()
    .max(max, `${label} must be at most ${max} characters`)
    .transform(blankToUndefined)
    .optional();
}

function optionalPattern(regex: RegExp, message: string) {
  return z
    .string()
    .trim()
    .transform(blankToUndefined)
    .optional()
    .refine((value) => value === undefined || regex.test(value), { message });
}

// GSTIN/PAN are uppercase-only shapes — uppercased before validation
// (26-customer-management.md), unlike company-schema.ts's as-entered rule.
function optionalUppercasePattern(regex: RegExp, message: string) {
  return z
    .string()
    .trim()
    .toUpperCase()
    .transform(blankToUndefined)
    .optional()
    .refine((value) => value === undefined || regex.test(value), { message });
}

// The underlying Ledger's name — same bounds as ledger-schema.ts's
// NAME_SCHEMA, surfaced as "Display Name" on the combined form.
const DISPLAY_NAME_SCHEMA = z
  .string()
  .trim()
  .min(2, "Display name must be at least 2 characters")
  .max(100, "Display name must be at most 100 characters");

const OPENING_BALANCE_SCHEMA = z
  .number()
  .min(0, "Opening balance must be zero or greater")
  .max(MAX_AMOUNT, "Opening balance is too large")
  .refine(hasAtMostTwoDecimals, {
    message: "Opening balance can have at most 2 decimal places",
  });

const CREDIT_LIMIT_SCHEMA = z
  .number("Credit limit must be a number")
  .min(0, "Credit limit must be 0 or more")
  .max(MAX_AMOUNT, "Credit limit is too large")
  .refine(hasAtMostTwoDecimals, { message: "Credit limit can have at most 2 decimal places" })
  .optional();

const CREDIT_DAYS_SCHEMA = z
  .number("Credit days must be a number")
  .int("Credit days must be a whole number")
  .min(0, "Credit days must be 0 or more")
  .max(MAX_CREDIT_DAYS, `Credit days must be at most ${MAX_CREDIT_DAYS}`)
  .optional();

export const createCustomerSchema = z.object({
  displayName: DISPLAY_NAME_SCHEMA,
  // The server re-validates active + "Sundry Debtors or descendant" — this
  // only guards the shape (never trust a client-supplied group id).
  ledgerGroupId: z.uuid("Please select a ledger group."),
  customerType: z.enum(CUSTOMER_TYPE_VALUES, "Select a customer type"),
  contactPerson: optionalText(100, "Contact person"),
  mobileNumber: optionalPattern(MOBILE_REGEX, "Enter a valid 10-digit mobile number"),
  alternateMobile: optionalPattern(MOBILE_REGEX, "Enter a valid 10-digit mobile number"),
  email: optionalPattern(EMAIL_REGEX, "Enter a valid email address"),
  gstin: optionalUppercasePattern(GSTIN_REGEX, "Enter a valid 15-character GSTIN"),
  pan: optionalUppercasePattern(PAN_REGEX, "Enter a valid 10-character PAN"),
  addressLine1: optionalText(200, "Address line 1"),
  addressLine2: optionalText(200, "Address line 2"),
  city: optionalText(100, "City"),
  state: optionalText(100, "State"),
  district: optionalText(100, "District"),
  country: optionalText(100, "Country"),
  pinCode: optionalPattern(PIN_CODE_REGEX, "Enter a valid 6-digit PIN code"),
  creditLimit: CREDIT_LIMIT_SCHEMA,
  creditDays: CREDIT_DAYS_SCHEMA,
  openingBalance: OPENING_BALANCE_SCHEMA,
  openingBalanceType: z.enum(BALANCE_TYPES),
  description: optionalText(500, "Description"),
});

export type CreateCustomerInput = z.infer<typeof createCustomerSchema>;

// Create and Update accept the same field set (26-customer-management.md) —
// including ledgerGroupId, since re-parenting to another "Sundry Debtors"
// descendant is allowed and re-validated server-side. Kept as a separate
// named schema so a future spec can diverge them without touching callers.
export const updateCustomerSchema = createCustomerSchema;

export type UpdateCustomerInput = z.infer<typeof updateCustomerSchema>;
