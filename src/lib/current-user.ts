export interface CurrentUser {
  id: string;
  username: string;
  role: string;
  companyId: string | null;
}

/**
 * Temporary stand-in until 07-authentication.md is implemented.
 * There is no session yet, so every request is treated as an Administrator.
 * TODO(07-authentication): replace with a real session-based lookup.
 */
export async function getCurrentUser(): Promise<CurrentUser> {
  return { id: "dev-user", username: "dev", role: "Administrator", companyId: null };
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
