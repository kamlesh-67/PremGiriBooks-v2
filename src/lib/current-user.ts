import { cache } from "react";
import { cookies } from "next/headers";

import { AppError } from "@/lib/app-error";
import { COOKIE_KEYS } from "@/constants/cookie-keys";
import { getSessionWithUser } from "@/lib/session";

// A PLATFORM user (Super Admin) never belongs to a company or holds a Role;
// a COMPANY user always has both. Modeled as a discriminated union (rather
// than a single interface with optional fields) so every call site that
// needs companyId/role is forced to narrow via getCurrentCompanyUser()
// first, instead of reading a value that could silently be undefined.
export interface PlatformCurrentUser {
  id: string;
  username: string;
  fullName: string;
  userType: "PLATFORM";
}

export interface CompanyCurrentUser {
  id: string;
  username: string;
  fullName: string;
  userType: "COMPANY";
  role: string;
  companyId: string;
}

export type CurrentUser = PlatformCurrentUser | CompanyCurrentUser;

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

  const { user } = result;

  if (user.userType === "PLATFORM") {
    return {
      id: user.id,
      username: user.username,
      fullName: user.fullName,
      userType: "PLATFORM",
    };
  }

  // A COMPANY-type session row is only ever created for a user that already
  // has companyId/roleId populated (userService.createUser and the
  // TenantBootstrapService-driven Company Admin creation both guarantee
  // this) — but the columns are nullable at the schema level to support
  // PLATFORM users, so TypeScript still sees them as string | null here.
  // Throwing on a genuinely null value surfaces a real data-integrity bug
  // immediately instead of quietly returning a broken CompanyCurrentUser.
  if (!user.role || !user.companyId) {
    throw new AppError("A COMPANY user must have a role and a company assigned.");
  }

  return {
    id: user.id,
    username: user.username,
    fullName: user.fullName,
    userType: "COMPANY",
    role: user.role.name,
    companyId: user.companyId,
  };
});

/** Safe to call from any Server Component, including the public /login page. */
export async function getCurrentUserOrNull(): Promise<CurrentUser | null> {
  return resolveCurrentUser();
}

export class AuthenticationError extends AppError {
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

/**
 * Runs `resolve` and fails closed (returns null) if it throws
 * AuthenticationError — the shared pattern `getCurrentCompany()` and
 * `getCurrentFinancialYear()` use so a stale selection cookie outliving its
 * session resolves to "nothing selected" instead of crashing RootLayout
 * (which renders for every page, including the public /login page). Any
 * other error still propagates.
 */
export async function resolveFailingClosed<T>(resolve: () => Promise<T>): Promise<T | null> {
  try {
    return await resolve();
  } catch (error) {
    if (error instanceof AuthenticationError) {
      return null;
    }
    throw error;
  }
}

export class AuthorizationError extends AppError {
  constructor(message = "You do not have permission to perform this action.") {
    super(message);
    this.name = "AuthorizationError";
  }
}

/**
 * Narrows CurrentUser to CompanyCurrentUser — the mechanism every
 * company-scoped module (bank-accounts, ledgers, ledger-groups,
 * financial-year, company-settings, users, roles, permissions, profile)
 * uses instead of getCurrentUser(), so companyId/role stay guaranteed
 * non-null without every call site re-checking userType itself. A PLATFORM
 * user calling a company-scoped action is a genuine authorization failure,
 * not a "not logged in" state.
 */
export async function getCurrentCompanyUser(): Promise<CompanyCurrentUser> {
  const user = await getCurrentUser();
  if (user.userType !== "COMPANY") {
    throw new AuthorizationError("This action is only available to company users.");
  }
  return user;
}

/**
 * Super Admin is not a Role — per
 * architecture-Migration-Super-Admin-Administration.md, it is determined
 * purely by userType === PLATFORM. This is the only hardcoded identity
 * check left in the app; every Company-side authorization decision goes
 * through assertPermission() (src/lib/permissions.ts) instead.
 */
export async function isCurrentUserSuperAdmin(): Promise<boolean> {
  const user = await getCurrentUser();
  return user.userType === "PLATFORM";
}

export async function assertSuperAdmin(): Promise<void> {
  if (!(await isCurrentUserSuperAdmin())) {
    throw new AuthorizationError("Only Super Admin can perform this action.");
  }
}

/**
 * Narrows CurrentUser to PlatformCurrentUser — for the (rarer) case where a
 * Super-Admin-only service method also needs the actor's id, e.g. for an
 * AuditLog entry, not just a boolean gate.
 */
export async function getCurrentSuperAdmin(): Promise<PlatformCurrentUser> {
  const user = await getCurrentUser();
  if (user.userType !== "PLATFORM") {
    throw new AuthorizationError("Only Super Admin can perform this action.");
  }
  return user;
}
