import { ZodError } from "zod";

import { AppError } from "@/lib/app-error";
import { logger } from "@/lib/logger";

const GENERIC_ERROR_MESSAGE = "Something went wrong. Please try again.";

/**
 * Shared Server Action error-to-message translator (Phase 01 closure Platform
 * Improvement: replaces every module's near-identical local `toErrorMessage`,
 * see context/Phases/phase-01-closure-notes.md).
 *
 * Only `AppError` (and its subclasses — AuthorizationError,
 * AuthenticationError, InvalidCredentialsError) and `ZodError` have their
 * `.message` surfaced to the client. Every other thrown value — including a
 * plain `Error` from an unexpected failure (a raw Prisma error, a dropped
 * connection, a bug) — is logged server-side via the shared Pino logger and
 * replaced with a generic message, so internal detail never reaches the
 * client. This closes the previously-documented gap where a module's
 * `toErrorMessage` fell through to `error.message` for any `Error` instance.
 */
export function toActionErrorMessage(error: unknown): string {
  if (error instanceof AppError) {
    return error.message;
  }

  if (error instanceof ZodError) {
    return error.issues[0]?.message ?? "Invalid input.";
  }

  logger.error({ err: error }, "Unhandled Server Action error");
  return GENERIC_ERROR_MESSAGE;
}
