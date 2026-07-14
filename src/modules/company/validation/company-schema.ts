import { z } from "zod";

const GSTIN_REGEX = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
const PAN_REGEX = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/;
const MOBILE_REGEX = /^[6-9]\d{9}$/;
const PIN_CODE_REGEX = /^[1-9][0-9]{5}$/;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const WEBSITE_REGEX = /^https?:\/\/.+/i;

function optionalText(): z.ZodOptional<z.ZodString> {
  return z.string().trim().optional();
}

function optionalPattern(regex: RegExp, message: string) {
  return z
    .string()
    .trim()
    .optional()
    .refine((value) => !value || regex.test(value), { message });
}

export const companySchema = z.object({
  companyName: z.string().trim().min(2, "Company name must be at least 2 characters"),
  legalName: z.string().trim().min(2, "Legal name must be at least 2 characters"),
  displayName: optionalText(),
  businessType: optionalText(),
  gstin: optionalPattern(GSTIN_REGEX, "Enter a valid 15-character GSTIN"),
  pan: optionalPattern(PAN_REGEX, "Enter a valid 10-character PAN"),
  tan: optionalText(),
  cin: optionalText(),
  mobileNumber: optionalPattern(MOBILE_REGEX, "Enter a valid 10-digit mobile number"),
  alternateMobile: optionalPattern(MOBILE_REGEX, "Enter a valid 10-digit mobile number"),
  email: optionalPattern(EMAIL_REGEX, "Enter a valid email address"),
  website: optionalPattern(WEBSITE_REGEX, "Enter a valid website URL"),
  addressLine1: optionalText(),
  addressLine2: optionalText(),
  city: optionalText(),
  state: optionalText(),
  district: optionalText(),
  country: z.string().trim().min(1, "Country is required"),
  pinCode: optionalPattern(PIN_CODE_REGEX, "Enter a valid 6-digit PIN code"),
  currency: z.string().trim().min(1, "Currency is required"),
  currencySymbol: z.string().trim().min(1, "Currency symbol is required"),
  decimalPlaces: z.number().int().min(0).max(4),
  logo: optionalText(),
});

export type CompanyInput = z.infer<typeof companySchema>;

// The subset of companySchema a Company Admin may edit for their own company
// via /company/[id]/edit — everything except the compliance-sensitive
// registration identifiers (legalName, gstin, pan, tan, cin) and the
// currency ISO code, which stay Super-Admin-only
// (/administration/companies/[id]/edit) per the Company Module split.
export const companyProfileSchema = companySchema.omit({
  legalName: true,
  gstin: true,
  pan: true,
  tan: true,
  cin: true,
  currency: true,
});

export type CompanyProfileInput = z.infer<typeof companyProfileSchema>;

export const companySettingsSchema = z.object({
  defaultTheme: z.enum(["light", "dark", "system"]),
  dateFormat: z.enum(["DD/MM/YYYY", "MM/DD/YYYY", "YYYY-MM-DD"]),
  timeFormat: z.enum(["12h", "24h"]),
  numberFormat: z.string().trim().min(1, "Number format is required"),
  currencyFormat: z.string().trim().min(1, "Currency format is required"),
});

export type CompanySettingsInput = z.infer<typeof companySettingsSchema>;
