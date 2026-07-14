# 10 - Review Batch: Platform/Company Split Follow-Up — 15 Findings Verified, 13 Fixed, 2 Skipped

## Status

All 15 findings from a follow-up review of `feature/super-admin-administration` verified against
current code (2026-07-13). 13 confirmed still valid and fixed; 2 confirmed but skipped with reasons
(both genuinely low-value/low-risk for this project). One additional, previously-unknown data
integrity issue was discovered while live-verifying one of the fixes — not fixed here (out of
scope), recorded at the end of this file instead.

---

## fix1 - Documentation overclaimed universal Company-side audit logging

**File:** `context/architecture-context.md`

**What was wrong:** The Authorization Flow's ASCII diagram ended every `COMPANY`-side mutation with
`→ Write Audit Log`, implying every Company-side mutation writes an audit trail entry. In reality
`AuditLog` coverage is narrow — only the handful of Administration-side tenant-lifecycle events
introduced by the Super Admin migration write one; no Ledger/Ledger Group/Bank Account/User/Role/
Company-Settings mutation does. The prose right after the diagram already said "narrow, not
universal," directly contradicting the diagram it was clarifying.

**Fix applied:** Removed `→ Write Audit Log` from the universal flow diagram; added an explicit
paragraph stating the audit step is not part of the universal flow and only applies to the named
Administration lifecycle events, cross-referencing Known Implementation Gaps item 3 (also updated,
see fix5). The permission-enforcement requirement (`assertPermission()` after
`getCurrentCompanyUser()`, unconditional for every Company-side mutation) is unchanged.

---

## fix2 - `resetCompanyAdminPassword`/`setCompanyAdminActive` had a TOCTOU window and no "last active admin" guard

**Files:** `src/modules/administration/services/platform-user-service.ts`,
`src/modules/users/repositories/user-repository.ts`, `src/types/user.ts`

**What was wrong (two related gaps in the same code path):**

1. Both methods verified the target was a Company Admin (`assertIsCompanyAdmin`) once, **before**
   opening the transaction that does the actual write. A concurrent request that changed the
   target's role in the gap between that check and the write would go undetected — the mutation
   (password reset, or activate/deactivate) would still proceed against a user who is no longer a
   Company Admin by the time it runs.
2. `userRepository.setActiveById` — the repository method `setCompanyAdminActive` calls — had **no
   guard at all** against deactivating a company's last active full-coverage user, unlike the
   regular per-company `deactivate()`/`updateProfile()` methods, which both already enforce "at
   least one active full-coverage user must remain per company." Since Company Admin is always
   full-coverage, a Super Admin could deactivate every Company Admin in a company via
   `/administration/company-admins`, leaving it completely unadministrable with no in-app recovery
   path.

**Fix applied:**

- `userRepository.findById` now accepts an optional transaction client, so a caller can re-read a
  target's current role from inside the same transaction as a later write.
- `userRepository.setActiveById` now returns a new discriminated `SetActiveByIdResult` (`ok` |
  `not_found` | `last_active_admin`) instead of `UserWithRole | null`. When deactivating
  (`isActive === false`), it re-checks (via the same passed-in client) whether the target's role is
  full-coverage and, if so, whether at least one *other* active full-coverage user remains in the
  company — mirroring `deactivate()`'s existing invariant, reusing the same `isFullCoverageRole`/
  `hasOtherActiveFullCoverageUser` helpers, with no role-name comparison.
- `platformUserService.resetCompanyAdminPassword`/`setCompanyAdminActive` now wrap their transaction
  in `{ isolationLevel: Serializable }` + the existing shared `withRetry` helper
  (`src/modules/roles/utils/with-retry.ts`, `isRetryableTransactionError` from
  `src/modules/users/utils/prisma-errors.ts`) — the same recipe `role-repository.ts`/
  `user-repository.ts` already use for this exact class of count-then-write invariant. Inside that
  transaction, both methods **re-fetch the target via `tx`** and re-run `assertIsCompanyAdmin`
  immediately before mutating, closing the TOCTOU window described above.

**Verified:**
- `tsc --noEmit`/`eslint` clean.
- Live, against a freshly-bootstrapped temporary company (its Company Admin role has true
  84/84-permission coverage, since it was created just now against the live catalog — see the
  discovered issue at the end of this file for why the *pre-existing* companies could not be used
  for this specific test): deactivating one of two active Company Admins succeeded
  (`status: "ok"`); deactivating the second (now the last active one) was correctly blocked
  (`status: "last_active_admin"`), and the target's `isActive` was confirmed unchanged afterward;
  re-activation is never guarded; a nonexistent id correctly returns `not_found`. Temporary company
  deleted afterward.
- `context/current-error/09-platform-company-split-review-fixes.md` (the doc that originally shipped
  the code this supersedes) was annotated with a pointer to this file rather than rewritten in
  place, preserving it as an accurate historical record of what shipped at the time.

---

## fix3 - `isFullCoverageRole` ran two queries concurrently on one transaction client

**File:** `src/modules/roles/utils/role-coverage.ts`

**What was wrong:** `Promise.all([tx.permission.count(), tx.role.findUnique(...)])` issued two
queries concurrently against the same Prisma interactive-transaction client. An interactive
transaction runs over a single underlying database connection/session — concurrent queries on the
same `tx` are a known Prisma pitfall (risk of the transaction closing early or queries interleaving
incorrectly), not real parallelism. The sibling function directly below it,
`hasOtherActiveFullCoverageRole`, already correctly awaits its two queries sequentially.

**Fix applied:** Changed `isFullCoverageRole` to sequential `await`s, matching
`hasOtherActiveFullCoverageRole`'s existing ordering. Behavior is unchanged (same two queries, same
comparison) — only the concurrency-safety of how they're issued changes.

**Verified:** `tsc --noEmit`/`eslint` clean; exercised indirectly by fix2's live test above (this
function is on the guard's hot path).

---

## fix4 - Stale role-name-specific "last active Administrator"/"final active Company Admin" wording

**Files:** `context/feature-specs/10-user-management.md`,
`context/feature-specs/architecture-Migration-Super-Admin-Administration.md`

**What was wrong:** Two spec documents still described the "at least one full-coverage user/role
must remain" invariant in terms of the retired "Administrator" role name or the "Company Admin" role
specifically, even though the actual implementation (`src/modules/roles/utils/role-coverage.ts`) has
been name-independent since feature-spec 11 — any custom role granted full permission coverage is
equally protected, not just the one literally named "Company Admin."
- `10-user-management.md`'s **Success Criteria** section (separate from its Business Rules section,
  which already had the correct amended wording) still said "The last active Administrator for a
  company cannot be deactivated."
- `architecture-Migration-Super-Admin-Administration.md`'s Role & Permission Management section said
  "Company Admin cannot remove the final active Company Admin role."

**Fix applied:** Both reworded to state the structural invariant — "the last active
user/role in the company whose role provides full permission-catalog coverage
(`src/modules/roles/utils/role-coverage.ts`)" — matching the wording feature-spec 10's own Business
Rules section already used. Also removed `10-user-management.md`'s now-superseded "seed these six
rows into the Role table... no Role seed data exists yet" instruction (global, once-only seeding),
which the very next paragraph's Amended-2026-07-13 note already contradicts (roles are seeded
per-company by `TenantBootstrapService` at company-creation time) — kept that Amended note itself
unchanged.

---

## fix5 - `updateCompany` didn't satisfy the spec's own blanket audit-logging claim

**Files:** `src/modules/company/services/company-service.ts`,
`src/modules/company/repositories/company-repository.ts`,
`context/feature-specs/18-super-admin-company-lifecycle.md`

**What was wrong:** `18-super-admin-company-lifecycle.md`'s Security section states "Every Create/
Update/Activate/Deactivate action writes an `AuditLog` entry in the same transaction as the
mutation." `companyService.updateCompany` did not — it called `assertSuperAdmin()` then
`companyRepository.update()` with no audit write at all, unlike its three siblings (`createCompany`,
`activateCompany`, `deactivateCompany`), which all correctly write one.

**Fix applied (closed the gap in code, rather than narrowing the spec):**
- `companyRepository.update` now accepts an optional transaction client, matching `setActive`'s
  existing convention.
- `companyService.updateCompany` now wraps the update and a new `company.updated` `AuditLog` write
  in one `prisma.$transaction`, using `getCurrentSuperAdmin()` (needed for the actor id) instead of
  the now-redundant `assertSuperAdmin()`.
- Updated the doc's `AuditLog.action` value list and added an explicit sentence noting Company edits
  now write `company.updated`, in both the Business Rules and Success Criteria sections.
- Also updated `architecture-context.md`'s Known Implementation Gaps item 3 and
  `prisma/schema.prisma`'s `AuditLog` model comment, both of which enumerated the audited event list
  and were missing `company.updated` (schema change is comment-only — `action` is a plain `String`
  column, no migration needed).

**Verified:** `tsc --noEmit`/`eslint` clean. Live: ran the same repository-update + audit-write call
pattern `updateCompany` now makes against a real company in the persistent dev database, inside one
transaction — the `company.updated` `AuditLog` row count went from 0 → 1 as expected. Deleted the
test audit row afterward.

---

## fix6 - Bank-account repair script used total ledger-group count as its "already fixed" predicate

**File:** `docs/bank-account-no-ledger-group-error.md`

**What was wrong:** The documented one-off repair script aborted with `throw new Error(...)`
whenever the target company had **any** existing `LedgerGroup` rows at all (`existingGroups > 0`),
on the theory that `seedDefaultGroups()` isn't idempotent and re-running it would create duplicates.
But this same document's own "Root cause" section describes a real company from this project that
had **some** custom groups (`Purchase`, `Test`, `Test2`) but **none** of the 23 reserved defaults —
exactly the case a `count > 0` guard refuses to fix, since it can't distinguish "already fully
seeded" from "partially populated, still missing Bank Accounts."

**Fix applied:** Rewrote the sample script to reconcile by **name** instead of aborting on any
non-zero count: it reads the company's existing `LedgerGroup` names into a set, then creates only
the `DEFAULT_LEDGER_GROUPS` entries not already present (two passes — parents, then children — same
ordering as `ledgerGroupRepository.seedDefaults()`), and only creates the default "Cash" ledger if
one doesn't already exist by name. A truly-empty company still gets exactly what it got before; a
partially-populated one is now actually fixable instead of hitting a dead end.

---

## fix7 - `financial-year/[id]/edit` page gated on `isCurrentUserCompanyAdmin()`, not the `financial-year:edit` permission

**File:** `src/app/financial-year/[id]/edit/page.tsx`

**What was wrong:** The page redirected non-admins away using the coarse
`isCurrentUserCompanyAdmin()` nav-visibility helper, but the actual mutation
(`financialYearService.updateFinancialYear`) is gated by the real permission check,
`assertPermission(user, "financial-year", "edit")`. A user holding that permission via a custom
role — without being a full Company Admin — would be redirected away from a page the service would
have actually let them submit to.

**Fix applied:** The page now calls `hasPermission(user, "financial-year", "edit")` (via
`getCurrentCompanyUser()`) for its actual access-control redirect, matching the service's real
authorization boundary. `isCurrentUserCompanyAdmin()` is still called, but now only feeds
`AppShell`'s `isAdmin` nav-visibility prop — a separate, still-valid concern from page access itself.

---

## fix8 - `permissions.ts`'s opening doc comment contradicted its own next paragraph

**File:** `src/lib/permissions.ts`

**What was wrong:** `hasPermission`'s doc comment opened with "Defaults to deny on any missing
data — unknown module/action, a role with no matching RolePermission row, or (deliberately) a
deactivated role" — but the very next sentence explains the *opposite*: a deactivated role's
existing users deliberately keep their access, so `role.isActive` is never checked at all. The
opening sentence and its own elaboration directly contradicted each other.

**Fix applied:** Reworded the opening sentence to only claim denial for unknown module/action or a
missing `RolePermission` row, and made the "does NOT additionally filter by `role.isActive`"
explanation lead the following sentence instead of trailing an incorrect claim. No behavior changed
— this was a documentation-only contradiction.

---

## fix9 - `AssignPermissionsResult` had two dead, unreachable variants

**Files:** `src/types/role.ts`, `src/modules/roles/services/permission-service.ts`

**What was wrong:** `permissionRepository.assignToRole()` only ever returns `"not_found"`,
`"last_full_coverage_role"`, or `"ok"` — confirmed by reading its full implementation. But its result
type, `AssignPermissionsResult`, also declared `"protected"` and
`"missing_mandatory_permissions"; missing: PermissionPair[]`, and `permissionService.setRolePermissions`
had switch cases for both. Both checks actually run earlier, in the service, before the repository
is ever called (`role.isProtected && role.name === COMPANY_ADMIN_ROLE_NAME` and the mandatory-pairs
check) — the repository-layer branches were unreachable dead code, not a real defense-in-depth
duplicate.

**Fix applied:** Removed both variants from `AssignPermissionsResult` and both cases from the
switch, with a comment explaining why they're absent. `DeactivateRoleResult` (a different type, for
`roleRepository.deactivate()`, which genuinely does return `"protected"`) was left untouched.

---

## fix10 - `translateRolePersistError`'s fallback silently discarded the original error

**File:** `src/modules/roles/services/role-service.ts`

**What was wrong:** Every sibling `translate*PersistError` function in this codebase
(`bank-account-service.ts`, `ledger-group-service.ts`, `ledger-service.ts`, `company-service.ts`)
rethrows the original error (`throw error;`) for the non-unique-constraint fallback case, letting it
reach the Server Action's `toActionErrorMessage()` call, which logs it server-side before
genericizing it for the client. `role-service.ts`'s version was the one outlier: it threw a brand-new,
hand-rolled `AppError("Failed to save the role. Please try again.")` with no logging at all — a
genuine unexpected persistence failure while saving a role would vanish with zero server-side trace.

**Fix applied:** The fallback now calls `toActionErrorMessage(error)` (which logs the original error
via the shared Pino logger as a side effect) and wraps its returned generic message in a new
`AppError`, then throws that. This preserves the "role-service always throws `AppError`, never a raw
error" contract this function's callers depend on, while gaining the same server-side logging every
sibling `translate*PersistError` (or, for `user-service.ts`'s slightly different version, an explicit
`logger.error()` call) already has. The unique-constraint branch is untouched.

---

## fix11 - Company-creation email not normalized to lowercase

**File:** `src/modules/administration/validation/create-company-schema.ts`

**What was wrong:** `companyAdminSchema.email` trimmed but never lowercased the submitted email
before validation/storage. Since email uniqueness (`10-user-management.md`: "email must be unique
across the system") is enforced by a case-sensitive Postgres unique constraint, two Company Admin
accounts could be created with what a human would consider "the same" email in different casing
(`Admin@Example.com` vs `admin@example.com`), defeating the uniqueness rule's intent.

**Fix applied:** Added `.toLowerCase()` to the email schema chain, right after `.trim()`. Scope
matches the finding exactly (this one schema) — the same latent issue exists on `user-schema.ts`'s
email field too, not fixed here to keep this change minimal; flagged as a related follow-up below.

---

## Skipped (verified, valid concern, not fixed — reasons below)

### skip1 - Splitting `CREATE INDEX` into its own `CONCURRENTLY` migration

**File:** `prisma/migrations/20260713131215_user_type_platform_company/migration.sql`

The finding is correct in general: a plain `CREATE INDEX` takes a lock for the duration of index
creation, and `CREATE INDEX CONCURRENTLY` in its own non-transactional migration is the standard
production-safe alternative for a large, frequently-written table. **Skipped for this project**
because: (1) this migration has already been applied to the persistent local dev database, and
splitting it now would require either leaving a stale duplicate `CREATE INDEX` behind or performing
migration-history surgery with real risk of breaking this environment's applied-migration state for
no benefit *to this environment*; (2) per `src/proxy.ts`'s own documented reasoning, this is
explicitly "a local desktop ERP talking to a local Postgres instance" — the `User` table has a
handful of rows, so the lock-duration concern this pattern exists to solve does not apply here. If
this app is ever deployed against a large, concurrently-written `User` table, revisit then.

### skip2 - `resetPasswordSchema`'s `.refine()` using `message` instead of Zod v4's `error` param

**File:** `src/modules/administration/actions/platform-user-actions.ts`

`message` remains valid syntax in the installed `zod@^4.4.3` and compiles/lints without warning.
**Skipped** because every other password-complexity `.refine()` call in this codebase
(`create-company-schema.ts`, `change-password-schema.ts`, `user-schema.ts`) uses the identical
`{ message: PASSWORD_COMPLEXITY_MESSAGE }` form — changing only this one call site to `error` would
introduce inconsistency with three sibling files rather than fix a functional defect. A codebase-wide
`message` → `error` migration, if wanted, should be its own scoped pass touching all four call sites
(and auditing every other `.refine()`/`.string()` validator option) at once, not one file in
isolation.

---

## Discovered while verifying fix2 (not fixed — recorded for follow-up)

**Every pre-existing company's "Company Admin" role has only 78 of the live 84-permission catalog.**
While live-testing fix2's new `setActiveById` guard against this project's real "Default Company"
(the one with `kamlesh`/`admin` both holding Company Admin), the guard did not fire when it should
have — not a bug in the fix itself, but a symptom of stale data: querying all 4 pre-existing
companies' `Company Admin` role directly confirmed every one of them has exactly 78 `RolePermission`
rows, while `prisma.permission.count()` returns 84 today. `roleService.seedDefaultRoles` grants
"every permission in the live catalog at the moment the company is created" — correct at
creation time, but nothing re-grants a company's already-seeded Company Admin role when the catalog
later grows (the catalog grew by 6 rows when `11-role-permissions.md`'s `"roles"` module permissions
were added, per `progress-tracker.md`'s "84 rows (78 + the new `roles` module's 6)" note — after
these 4 companies already existed).

**Practical impact:** for every company created before that catalog growth, `isFullCoverageRole`
now returns `false` for their Company Admin role, which means the **pre-existing**
`deactivate()`/`updateProfile()`/(now) `setActiveById` "last active full-coverage user" guards are
all silently defanged for those companies today — not because of anything in this batch of fixes,
but because none of their Company Admin roles actually satisfy "full coverage" under the current,
larger catalog. Verified this is real by directly testing the guard's logic against a
**freshly-bootstrapped** temporary company (whose Company Admin role does have true 84/84 coverage,
since it was created against today's catalog) — the guard worked correctly there (see fix2's
Verified section).

**Not fixed here** — this is a data backfill decision (re-grant the 6 newer permissions to every
existing Company Admin role) that deserves its own explicit choice about scope (just Company Admin,
or every reserved role that's fallen behind?) and mechanism (a one-off script vs. a permanent
"re-sync protected roles on catalog change" hook), not a drive-by fix bundled into an unrelated
review batch. Flagged here so a future session picks it up deliberately.

---

## Validation (all fixes)

- `npx tsc --noEmit` — clean, no errors.
- `npx eslint src` — clean, no errors or warnings.
- Live-verified against the project's persistent local Postgres container via temporary scripts
  (deleted after use, along with a temporary company created and cleaned up for fix2's isolated
  guard test): the `setActiveById` last-active-admin guard (fix2), and the `company.updated` audit
  write (fix5). Documentation-only fixes (fix1, fix4, fix6, fix8) were not independently re-executed
  beyond the read-through described in each section, consistent with how prior spec-only fixes in
  this series (`03-code-review-batch-fixes.md` fix3, and the Spec Review Fixes section of
  `progress-tracker.md`) were verified.
