export const COOKIE_KEYS = {
  ACTIVE_COMPANY_ID: "active_company_id",
} as const;

export type CookieKey = (typeof COOKIE_KEYS)[keyof typeof COOKIE_KEYS];
