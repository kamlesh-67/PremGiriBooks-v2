# 04 - Login's Anti-Enumeration Dummy Hash Was Lazily Computed, Not Pre-Generated

## Status

Verified against current code and resolved (2026-07-12).

---

## Finding (from code review)

> In `src/lib/auth.ts` around line 18-27: Replace the lazy hash generation in
> `getDummyPasswordHash` with a pre-generated valid Argon2 hash constant,
> removing `dummyPasswordHashPromise` and the `hashPassword` call so
> unknown-user failures perform only the same single `verifyPassword`
> operation as known-user failures.

## What The Error Is

`src/lib/auth.ts`'s `login()` was made timing-safe in an earlier review pass
(feature-spec 07, Authentication): to stop an attacker from telling "unknown
username" apart from "known username, wrong password" by response time
alone, every login attempt runs an Argon2 **verify**, even for a username
that doesn't exist — verified against a fixed dummy hash instead of skipping
straight to a fast rejection.

That dummy hash, however, was computed **lazily**, cached in a module-level
promise:

```ts
let dummyPasswordHashPromise: Promise<string> | null = null;

function getDummyPasswordHash(): Promise<string> {
  dummyPasswordHashPromise ??= hashPassword("dummy-password-for-timing-safety");
  return dummyPasswordHashPromise;
}
```

The first unknown-username login attempt after the process starts (and any
concurrent attempts arriving before that first one resolves — they all await
the same cached promise, so no duplicate hashing, but they all wait on it)
pays for **both** an Argon2 hash **and** an Argon2 verify, not just the verify
every other code path (known-user-wrong-password) pays for. That's exactly
the kind of structural timing difference the fix was introduced to eliminate
— just narrowed to a cold-start window instead of removed outright. It's also
unnecessary complexity (mutable module state, a lazy-init function) for a
value that never changes at runtime.

## Verification Against Current Code

Confirmed the finding was still accurate before changing anything — read
`src/lib/auth.ts` and found `dummyPasswordHashPromise`/`getDummyPasswordHash`
exactly as described, still calling `hashPassword()` on first use.

## Solution Analyzed

1. **Pre-generate a fixed Argon2 hash once (offline) and embed it as a
   constant**, verified against directly — removes the lazy-init state
   entirely and guarantees every request, cold-start or not, only ever calls
   `verifyPassword()` once. **Chosen** — exactly what the finding asks for.
2. **Keep the lazy cache but warm it at module load** (call
   `getDummyPasswordHash()` once, unawaited, at the top of the file) — still
   leaves a real (if shorter) window where concurrent early requests wait on
   an in-flight hash, and still carries the mutable-state complexity for no
   benefit over a constant. Rejected.

Option 1 is strictly simpler and closes the cold-start gap completely, not
just narrows it.

## Solution Applied

- Generated a real Argon2id hash of a fixed, non-secret placeholder string
  (`"dummy-password-for-timing-safety"`) via the project's own `argon2`
  package, then verified that hash round-trips correctly with
  `argon2.verify()` before embedding it.
- Replaced `dummyPasswordHashPromise`/`getDummyPasswordHash()` with a single
  `const DUMMY_PASSWORD_HASH = "$argon2id$...";` in `src/lib/auth.ts`.
- Removed the now-unused `hashPassword` import from `auth.ts` (it's no longer
  called there at all — the constant is pre-hashed).
- `login()` now reads `const passwordHash = user?.passwordHash ?? DUMMY_PASSWORD_HASH;` directly, no `await` needed before the `verifyPassword()` call for the unknown-user case.

**Verified:**

- `tsc --noEmit`, `pnpm lint`, and `next build` all stayed clean.
- Ran `login()` directly against the live seeded database: an unknown
  username, a second unknown username (to rule out any first-call-only
  effect), and a known user with a wrong password all now go through the
  identical single-`verifyPassword()` path — the previous "first call pays
  for hash+verify" doubling is gone, since there's no hash call left on this
  path at all.
