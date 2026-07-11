export const LOGO_MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024;

export const LOGO_ALLOWED_MIME_TYPES = ["image/png", "image/jpeg", "image/svg+xml"] as const;

export const LOGO_ACCEPT_ATTRIBUTE = ".png,.jpg,.jpeg,.svg";

export const BUSINESS_TYPE_SUGGESTIONS = [
  "Proprietorship",
  "Partnership",
  "LLP",
  "Private Limited",
  "Public Limited",
  "Other",
] as const;
