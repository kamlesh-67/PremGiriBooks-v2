"use client";

import * as React from "react";

import type { CompanyWithSettings } from "@/types/company";

interface CompanyContextValue {
  company: CompanyWithSettings | null;
  isLoading: boolean;
}

const CompanyContext = React.createContext<CompanyContextValue | undefined>(undefined);

interface CompanyProviderProps {
  initialCompany: CompanyWithSettings | null;
  children: React.ReactNode;
}

export function CompanyProvider({ initialCompany, children }: CompanyProviderProps) {
  const value = React.useMemo<CompanyContextValue>(
    () => ({ company: initialCompany, isLoading: false }),
    [initialCompany]
  );

  return <CompanyContext.Provider value={value}>{children}</CompanyContext.Provider>;
}

export function useCompany(): CompanyContextValue {
  const context = React.useContext(CompanyContext);
  if (!context) {
    throw new Error("useCompany must be used within a CompanyProvider");
  }

  return context;
}
