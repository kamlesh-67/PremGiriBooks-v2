export type ThemeMode = "light" | "dark" | "system";

export type DateFormat = "DD/MM/YYYY" | "MM/DD/YYYY" | "YYYY-MM-DD";

export type TimeFormat = "12h" | "24h";

export interface ThemeSettings {
  mode: ThemeMode;
}

export interface WindowSettings {
  width: number;
  height: number;
  x: number | null;
  y: number | null;
  isMaximized: boolean;
}

export interface ApplicationSettings {
  theme: ThemeMode;
  language: string;
  currency: string;
  dateFormat: DateFormat;
  timeFormat: TimeFormat;
  autoBackupEnabled: boolean;
  backupIntervalMinutes: number;
}
