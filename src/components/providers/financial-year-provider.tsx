"use client";

import * as React from "react";

import type { FinancialYear } from "@/types/financial-year";

interface FinancialYearContextValue {
  financialYear: FinancialYear | null;
  isLoading: boolean;
}

const FinancialYearContext = React.createContext<FinancialYearContextValue | undefined>(
  undefined
);

interface FinancialYearProviderProps {
  initialFinancialYear: FinancialYear | null;
  children: React.ReactNode;
}

export function FinancialYearProvider({
  initialFinancialYear,
  children,
}: FinancialYearProviderProps) {
  const value = React.useMemo<FinancialYearContextValue>(
    () => ({ financialYear: initialFinancialYear, isLoading: false }),
    [initialFinancialYear]
  );

  return (
    <FinancialYearContext.Provider value={value}>{children}</FinancialYearContext.Provider>
  );
}

export function useFinancialYear(): FinancialYearContextValue {
  const context = React.useContext(FinancialYearContext);
  if (!context) {
    throw new Error("useFinancialYear must be used within a FinancialYearProvider");
  }

  return context;
}
