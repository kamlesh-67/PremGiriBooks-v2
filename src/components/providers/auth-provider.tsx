"use client";

import * as React from "react";

import type { CurrentUser } from "@/lib/current-user";

interface AuthContextValue {
  user: CurrentUser | null;
}

const AuthContext = React.createContext<AuthContextValue | undefined>(undefined);

interface AuthProviderProps {
  initialUser: CurrentUser | null;
  children: React.ReactNode;
}

export function AuthProvider({ initialUser, children }: AuthProviderProps) {
  const value = React.useMemo<AuthContextValue>(() => ({ user: initialUser }), [initialUser]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = React.useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }

  return context;
}
