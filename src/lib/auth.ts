import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { hashPassword, verifyPassword } from "@/lib/password";
import { createSession, deleteSession } from "@/lib/session";

export class InvalidCredentialsError extends Error {
  constructor(message = "Invalid username or password.") {
    super(message);
    this.name = "InvalidCredentialsError";
  }
}

export interface LoginResult {
  sessionId: string;
  expiresAt: Date;
}

// A fixed, lazily-computed hash verified against when the username doesn't
// exist, so an unknown-username attempt costs the same Argon2 verify time as
// a known-username-wrong-password attempt — otherwise the two are
// distinguishable by response time alone, which lets an attacker enumerate
// valid usernames without ever seeing a different error message.
let dummyPasswordHashPromise: Promise<string> | null = null;

function getDummyPasswordHash(): Promise<string> {
  dummyPasswordHashPromise ??= hashPassword("dummy-password-for-timing-safety");
  return dummyPasswordHashPromise;
}

export async function login(
  username: string,
  plainPassword: string,
  rememberMe: boolean
): Promise<LoginResult> {
  const user = await prisma.user.findUnique({ where: { username } });
  const passwordHash = user?.passwordHash ?? (await getDummyPasswordHash());
  const passwordValid = await verifyPassword(passwordHash, plainPassword);

  // Every failure below throws the same InvalidCredentialsError — an unknown
  // username, a disabled account, and a wrong password must be
  // indistinguishable to the caller (anti-enumeration). Internally, each is
  // still logged with its real reason for audit purposes.
  if (!user) {
    logger.warn({ event: "login_failed", username, reason: "unknown_username" }, "Login failed: unknown username");
    throw new InvalidCredentialsError();
  }

  if (!user.isActive) {
    logger.warn({ event: "login_failed", username, reason: "disabled" }, "Login failed: user disabled");
    throw new InvalidCredentialsError();
  }

  if (!passwordValid) {
    logger.warn({ event: "login_failed", username, reason: "invalid_password" }, "Login failed: invalid password");
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
