import { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { REMEMBER_ME_DURATION_MS, SESSION_DURATION_MS } from "@/constants/session";

function isNotFoundError(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025";
}

async function deleteSessionRow(id: string): Promise<void> {
  try {
    await prisma.session.delete({ where: { id } });
  } catch (error) {
    if (!isNotFoundError(error)) {
      logger.warn({ event: "session_delete_failed" }, "Failed to delete session row");
    }
  }
}

export interface SessionUser {
  id: string;
  username: string;
  fullName: string;
  companyId: string;
  isActive: boolean;
  role: { name: string };
}

export interface SessionRecord {
  id: string;
  rememberMe: boolean;
  expiresAt: Date;
}

export interface SessionWithUser {
  session: SessionRecord;
  user: SessionUser;
}

function sessionDuration(rememberMe: boolean): number {
  return rememberMe ? REMEMBER_ME_DURATION_MS : SESSION_DURATION_MS;
}

export async function createSession(
  userId: string,
  rememberMe: boolean
): Promise<{ id: string; expiresAt: Date }> {
  const expiresAt = new Date(Date.now() + sessionDuration(rememberMe));
  const session = await prisma.session.create({
    data: { userId, rememberMe, expiresAt },
  });

  return { id: session.id, expiresAt: session.expiresAt };
}

export async function getSessionWithUser(token: string): Promise<SessionWithUser | null> {
  const session = await prisma.session.findUnique({
    where: { id: token },
    include: { user: { include: { role: true } } },
  });

  if (!session) {
    return null;
  }

  if (session.expiresAt.getTime() <= Date.now()) {
    logger.info({ event: "session_expired", userId: session.userId }, "Session expired");
    await deleteSessionRow(session.id);
    return null;
  }

  if (!session.user.isActive) {
    // A disabled account's sessions must not be resurrectable by later
    // reactivating the account — delete now rather than leave it to expire.
    await deleteSessionRow(session.id);
    return null;
  }

  return {
    session: { id: session.id, rememberMe: session.rememberMe, expiresAt: session.expiresAt },
    user: {
      id: session.user.id,
      username: session.user.username,
      fullName: session.user.fullName,
      companyId: session.user.companyId,
      isActive: session.user.isActive,
      role: { name: session.user.role.name },
    },
  };
}

/**
 * Returns null only if the session was genuinely gone (e.g. concurrently
 * deleted by a logout in another tab) — callers must treat that the same as
 * "no valid session." Any other failure (a transient DB error) is rethrown
 * rather than treated as "log the user out," since the session the caller
 * already validated is still good; it just couldn't be renewed this time.
 */
export async function renewSession(token: string, rememberMe: boolean): Promise<Date | null> {
  const expiresAt = new Date(Date.now() + sessionDuration(rememberMe));
  try {
    await prisma.session.update({
      where: { id: token },
      data: { expiresAt, lastUsedAt: new Date() },
    });
    return expiresAt;
  } catch (error) {
    if (isNotFoundError(error)) {
      return null;
    }
    logger.warn({ event: "session_renew_failed" }, "Failed to renew session");
    throw error;
  }
}

export async function deleteSession(token: string): Promise<void> {
  await deleteSessionRow(token);
}
