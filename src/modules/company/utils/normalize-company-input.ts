import type { CompanyInput } from "@/modules/company/validation/company-schema";

const NULLABLE_FIELDS = [
  "displayName",
  "businessType",
  "gstin",
  "pan",
  "tan",
  "cin",
  "mobileNumber",
  "alternateMobile",
  "email",
  "website",
  "addressLine1",
  "addressLine2",
  "city",
  "state",
  "district",
  "pinCode",
  "logo",
] as const;

type NullableField = (typeof NULLABLE_FIELDS)[number];

export type CompanyPersistData = Omit<CompanyInput, NullableField> &
  Record<NullableField, string | null>;

/**
 * Blank optional fields must be stored as NULL, not "" — Postgres allows
 * multiple NULLs in the unique `gstin` column but would reject duplicate
 * empty strings.
 */
export function normalizeCompanyInput(input: CompanyInput): CompanyPersistData {
  const normalized: Record<string, unknown> = { ...input };

  for (const field of NULLABLE_FIELDS) {
    const value = normalized[field];
    normalized[field] = value === "" || value === undefined ? null : value;
  }

  return normalized as CompanyPersistData;
}
