import { cache } from "react";
import { cookies } from "next/headers";

import { COOKIE_KEYS } from "@/constants/cookie-keys";
import { getSessionWithUser } from "@/lib/session";

export interface CurrentUser {
  id: string;
  username: string;
  fullName: string;
  role: string;
  companyId: string;
}

const resolveCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_KEYS.SESSION_TOKEN)?.value;
  if (!token) {
    return null;
  }

  const result = await getSessionWithUser(token);
  if (!result) {
    return null;
  }

  return {
    id: result.user.id,
    username: result.user.username,
    fullName: result.user.fullName,
    role: result.user.role.name,
    companyId: result.user.companyId,
  };
});

/** Safe to call from any Server Component, including the public /login page. */
export async function getCurrentUserOrNull(): Promise<CurrentUser | null> {
  return resolveCurrentUser();
}

export class AuthenticationError extends Error {
  constructor(message = "You must be signed in to perform this action.") {
    super(message);
    this.name = "AuthenticationError";
  }
}

/**
 * Every caller of this function runs on a route Proxy already guarantees is
 * authenticated (see src/proxy.ts) — throwing here signals a genuine
 * invariant violation rather than a normal "not logged in" UI state.
 */
export async function getCurrentUser(): Promise<CurrentUser> {
  const user = await resolveCurrentUser();
  if (!user) {
    throw new AuthenticationError();
  }

  return user;
}

export async function getCurrentUserRole(): Promise<string> {
  const user = await getCurrentUser();
  return user.role;
}

export async function isCurrentUserAdmin(): Promise<boolean> {
  return (await getCurrentUserRole()) === "Administrator";
}

export class AuthorizationError extends Error {
  constructor(message = "Only administrators can perform this action.") {
    super(message);
    this.name = "AuthorizationError";
  }
}

export async function assertAdministrator(): Promise<void> {
  const role = await getCurrentUserRole();
  if (role !== "Administrator") {
    throw new AuthorizationError();
  }
}
