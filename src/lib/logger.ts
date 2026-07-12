import pino from "pino";

export const logger = pino({
  level: process.env.NODE_ENV === "production" ? "info" : "debug",
  // Defense in depth: no current call site logs these fields, but this
  // guards against a future accidental `logger.info({ user }, ...)`-style
  // call leaking a password, hash, or session token.
  redact: {
    paths: [
      "password",
      "passwordHash",
      "token",
      "sessionToken",
      "*.password",
      "*.passwordHash",
      "*.token",
      "*.sessionToken",
    ],
    censor: "[REDACTED]",
  },
});
