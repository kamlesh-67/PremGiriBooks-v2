import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { verifyPassword } from "@/lib/password";
import { createSession, deleteSession } from "@/lib/session";

export class InvalidCredentialsError extends Error {
  constructor(message = "Invalid username or password.") {
    super(message);
    this.name = "InvalidCredentialsError";
  }
}

export class UserDisabledError extends Error {
  constructor(message = "This account has been disabled. Contact an administrator.") {
    super(message);
    this.name = "UserDisabledError";
  }
}

export interface LoginResult {
  sessionId: string;
  expiresAt: Date;
}

export async function login(
  username: string,
  plainPassword: string,
  rememberMe: boolean
): Promise<LoginResult> {
  const user = await prisma.user.findUnique({ where: { username } });

  if (!user) {
    logger.warn({ event: "login_failed", username }, "Login failed: unknown username");
    throw new InvalidCredentialsError();
  }

  if (!user.isActive) {
    logger.warn({ event: "login_failed", username, reason: "disabled" }, "Login failed: user disabled");
    throw new UserDisabledError();
  }

  const passwordValid = await verifyPassword(user.passwordHash, plainPassword);
  if (!passwordValid) {
    logger.warn({ event: "login_failed", username }, "Login failed: invalid password");
    throw new InvalidCredentialsError();
  }

  const session = await createSession(user.id, rememberMe);
  logger.info({ event: "login_success", username, userId: user.id }, "Login succeeded");

  return { sessionId: session.id, expiresAt: session.expiresAt };
}

export async function logout(sessionToken: string, username?: string): Promise<void> {
  await deleteSession(sessionToken);
  logger.info({ event: "logout", username }, "User logged out");
}
