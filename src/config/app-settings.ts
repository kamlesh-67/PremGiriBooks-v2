import type { ApplicationSettings } from "@/types/settings";

export const DEFAULT_APPLICATION_SETTINGS: ApplicationSettings = {
  theme: "dark",
  language: "en",
  currency: "INR",
  dateFormat: "DD/MM/YYYY",
  timeFormat: "24h",
  autoBackupEnabled: true,
  backupIntervalMinutes: 60,
};
