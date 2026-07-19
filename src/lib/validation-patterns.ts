// Shared Indian statutory/contact format patterns, extracted from
// company-schema.ts (which previously kept private copies) so
// 26-customer-management.md's customer-schema.ts reuses the exact same
// validation instead of writing a second regex — the same promotion pattern
// as src/lib/run-action.ts and src/lib/prisma-errors.ts. Both GSTIN and PAN
// are uppercase-only shapes: callers that accept lowercase input uppercase
// the value before testing (customer-schema.ts does; company-schema.ts
// deliberately keeps its stricter as-entered behavior unchanged).
export const GSTIN_REGEX = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
export const PAN_REGEX = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/;
export const MOBILE_REGEX = /^[6-9]\d{9}$/;
export const PIN_CODE_REGEX = /^[1-9][0-9]{5}$/;
export const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
