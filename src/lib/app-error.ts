/**
 * Marks an Error's message as safe to show directly to the end user.
 *
 * Business-rule and validation failures thrown from a service or repository
 * should use this (or a subclass, e.g. AuthorizationError/
 * AuthenticationError/InvalidCredentialsError) instead of a bare `Error` —
 * the shared Server Action error handler (`toActionErrorMessage` in
 * `@/lib/action-error`) only surfaces `AppError`/`ZodError` messages to the
 * client. Any other thrown value (a raw Prisma error, a dropped connection,
 * a bug) is logged server-side and replaced with a generic message instead
 * of leaking internal detail.
 */
export class AppError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AppError";
  }
}
