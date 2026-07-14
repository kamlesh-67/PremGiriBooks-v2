# 11 - Review Batch Round 2: Re-Audit of 4 Review Rounds Against Live Code

## Critical discovery: `10-review-batch-fixes.md` was never actually applied

`context/current-error/10-review-batch-fixes.md` claims 13 fixes were made and 2 were
deliberately skipped. That file was **never committed** (`git status` showed it as untracked at
the start of this session) and, on reading the actual current code, its claimed CODE changes
(fix2's TOCTOU/last-active-admin guard, fix3's sequential awaits, fix5's `updateCompany`
transaction+audit, fix8's doc wording, fix9's dead-code removal, fix10's error logging, fix11's
email lowercase, etc.) were **not present** in the working tree. Only some of its doc-only claims
happened to already be true independently. The most likely explanation: a prior session wrote the
report describing intended work but the corresponding edits were lost/never saved.

**Consequence:** every finding from all 4 pasted review rounds was re-verified from scratch
against the live file content in this session — none of it was taken on faith from `10-review-
batch-fixes.md` or any other prior report. `10-review-batch-fixes.md` itself is left untouched as
a historical (if inaccurate) record; this file supersedes it as the accurate account of what is
actually fixed as of now.

---

## Fixed (code)

1. **`role-coverage.ts` `isFullCoverageRole`** — two queries run concurrently on one transaction
   client (`Promise.all`) → sequential `await`s, matching the sibling function directly below it.
2. **`user-repository.ts` `findMany`** — one malformed row (missing role/companyId) threw and took
   down the entire list → isolated per-row with try/catch, logs and drops the bad row instead.
3. **`user-repository.ts` `findById`** — now accepts an optional transaction client, so callers can
   re-read a target inside their own transaction (needed by fix 5 below).
4. **`user-repository.ts` `setActiveById`** — had **no guard at all** against deactivating a
   company's last active full-coverage user (unlike `deactivate()`/`updateProfile()`, which both
   already enforce this). Now returns a `SetActiveByIdResult` (`ok`/`not_found`/
   `last_active_admin`) and enforces the same invariant. New type added to `types/user.ts`.
5. **`platform-user-service.ts` `resetCompanyAdminPassword`/`setCompanyAdminActive`** — validated
   the target was a Company Admin once, *before* opening the transaction that mutates it (TOCTOU
   window). Now wrapped in `{ isolationLevel: Serializable }` + `withRetry`, re-fetch and
   re-validate the target *inside* the transaction immediately before the write. Added
   `updateCompanyAdminProfile` (see Feature 2 below) with the same treatment.
6. **`company-service.ts` `updateCompany`** — called `assertSuperAdmin()` then
   `companyRepository.update()` with no audit write, unlike its siblings (`createCompany`,
   `activateCompany`, `deactivateCompany`). Now wraps the update + a new `company.updated`
   `AuditLog` write in one transaction. `companyRepository.update` gained an optional transaction
   client, matching `setActive`'s convention.
7. **`permission-service.ts` `assignToRole` dead code** — `AssignPermissionsResult` declared
   `"protected"`/`"missing_mandatory_permissions"` variants the repository never actually returns
   (both checks already run earlier in the service). Removed from the type and the switch.
8. **`permission-service.ts` `ensureCatalog` — Company Admin catalog-growth backfill.** Verified the
   real, previously-undiscovered gap: every pre-existing company's Company Admin role stops at
   whatever permission count existed when that company was created; nothing re-grants newly added
   catalog permissions, silently defanging the "last active full-coverage user" guard for those
   companies. Fixed: `ensureCatalog()` now also re-grants every catalog permission (additive-only,
   `skipDuplicates`) to every company's Company Admin role on every boot/seed run. Added
   `roleRepository.findAllProtectedByName()` (a platform-wide read, mirroring
   `userRepository.findAllCompanyAdmins()`'s existing cross-company exception).
9. **`role-repository.ts` `update()`** — added a repository-layer `isProtected` check (returns
   `null` if attempting to rename a protected role), mirroring `deactivate()`'s existing
   defense-in-depth "protected" check. The service-layer check (`role-service.ts`) already blocks
   this in practice; this closes the gap for any future caller that might bypass the service.
10. **`role-service.ts` `translateRolePersistError`** — the fallback threw a hand-rolled `AppError`
    with zero logging, unlike every sibling `translate*PersistError` in this codebase. Now routes
    through the shared `toActionErrorMessage()` (logs via the Pino logger as a side effect) before
    wrapping in `AppError`.
11. **`permissions.ts` doc comment** — opening sentence claimed denial for "a deactivated role"
    while the very next sentence said the opposite (deactivated roles' existing users keep access).
    Reworded so the two no longer contradict each other. No behavior change.
12. **`proxy.ts` `isPlatformAllowedRoute`** — extracted the exact-match-or-prefix-plus-slash logic
    into a shared `matchesRoutePrefix()` helper and applied it to the COMPANY-side check too, which
    previously used a bare `pathname.startsWith(ADMINISTRATION_PREFIX)` (could false-positive match
    an unrelated route sharing the same prefix characters).
13. **`create-company-schema.ts` / `user-schema.ts` email normalization** — neither lowercased the
    email before validation/storage, while uniqueness is a case-sensitive Postgres constraint —
    `Admin@x.com` and `admin@x.com` could both be created. Added `.toLowerCase()` to both (the
    latter wasn't in the original findings but has the identical bug; fixed for consistency).
14. **`financial-year/[id]/edit` page** — gated on the coarse `isCurrentUserCompanyAdmin()` instead
    of the real `financial-year:edit` permission the service actually enforces. Now gates on
    `hasPermission(user, "financial-year", "edit")`; `isCurrentUserCompanyAdmin()` still feeds only
    `AppShell`'s nav-visibility prop.
15. **`settings/roles/[id]/edit` page** — same class of bug, gated on `isCurrentUserCompanyAdmin()`
    instead of `roles:view`. Now gates on `hasPermission(user, "roles", "view")`.
16. **`accounting/banks/[id]/edit` page** — called `isCurrentUserCompanyAdmin()` for the `isAdmin`
    nav prop, which re-runs `getCurrentCompanyUser()` a second time even though the page already had
    `user` from its earlier permission check. Now reuses it: `hasPermission(user, "settings",
    "view")`.
17. **`company/[id]/edit` page — missing authorization gate.** This page computed `isAdmin` but only
    used it for `AppShell`'s nav prop — **any** authenticated company user (not just one holding
    `company:edit`) could reach it and submit the settings form. Now gates on
    `hasPermission(user, "company", "edit")` before rendering anything, matching
    `updateCompanyProfile`'s own gate (see Feature 1 below).
18. **`administration/*` pages — 9x duplicated Super-Admin guard.** `page.tsx`, `settings/page.tsx`,
    `audit/page.tsx`, `backup/page.tsx`, `licenses/page.tsx`, `companies/page.tsx`,
    `companies/new/page.tsx`, `companies/[id]/edit/page.tsx`, `company-admins/page.tsx` all repeated
    `if (!(await isCurrentUserSuperAdmin())) redirect("/")`. Extracted a shared
    `requireSuperAdmin()` helper in `src/lib/current-user.ts`; all 9 pages now call it.
19. **`create-company-form.tsx` / `company-form.tsx` — duplicated `FormSection`.** Extracted the
    (already near-identical) local definitions into `src/components/common/form-section.tsx`; both
    files and the new `CompanyProfileForm` (Feature 1) now import the shared one.
20. **`company-admin-table.tsx` — stale password on target switch.** Toggling to a different admin
    (or closing the panel) kept the previously-typed `newPassword` in state. Now cleared whenever
    the reset target changes.
21. **`constants/roles.ts` comment** — understated `COMPANY_ADMIN_ROLE_NAME`'s usage; now also
    mentions `user-repository.ts`'s `findAllCompanyAdmins` and the new `ensureCatalog` backfill.
22. **Bank-accounts module** (delegated to a parallel pass, verified against the same live-code
    standard as everything else in this file):
    - `bank-account-form.tsx` / `bank-account-edit-form.tsx`: cleared `openingBalance` produced
      `NaN` instead of a clean required-field error — both `onChange` handlers now pass `undefined`
      when `valueAsNumber` is `NaN`.
    - `bank-account-edit-form.tsx` `handleSubmit`: wrapped in `try/finally` so `setIsSubmitting`
      always resets even if the action throws (matches `create-company-form.tsx`'s convention).
    - `bank-account-repository.ts` `activate`/`deactivate`: removed an unnecessary extra
      `findUniqueOrThrow` refetch (the update's own `include` now returns the needed shape);
      extracted a shared `setBankAccountActive` helper; both now accept an optional transaction
      client, matching `create`/`update`'s convention, instead of opening their own transaction.
    - `bank-account-service.ts` `activateBankAccount`/`deactivateBankAccount`: now wrap the
      repository call and a new `bank_account.activated`/`deactivated` `AuditLog` write in one
      transaction.
    - `bank-account-service.ts` `createBankAccount`: added a transaction-scoped re-check of the
      target ledger group's `isActive` status (defense-in-depth against a TOCTOU window between the
      pre-transaction check and the actual write).

## Fixed (docs) — delegated to a parallel pass, summarized

`context/architecture-context.md`, `context/feature-specs/{06-database-foundation,08-company-
management,10-user-management,18-super-admin-company-lifecycle,ai-architecture-decisions}.md`,
`context/progress-tracker.md`, `docs/bank-account-no-ledger-group-error.md`, and
`context/current-error/09-platform-company-split-review-fixes.md` were each independently
re-verified against live code by the parallel doc pass. Several claims turned out to already be
accurate (08-company-management's split wording, 06-database-foundation's PLATFORM-nullability
notes, architecture-context.md's audit-logging qualification); the ones that were genuinely stale
were fixed: 10-user-management.md's Success Criteria section still had role-name-specific "last
active Administrator" wording (fixed to the name-independent invariant); ai-architecture-
decisions.md's placeholder "Last Updated: YYYY-MM-DD" and its Company Admin section's missing
cross-reference to permission-based authorization; progress-tracker.md's stale `canManage` prop
mention and "system-wide roles" statement; 18-super-admin-company-lifecycle.md's blanket audit
claim (now accurate again after fix 6 above closed the gap); and bank-account-no-ledger-group-
error.md's non-idempotent repair-script sample (rewritten to reconcile by name instead of aborting
on any existing groups).

---

## New features (explicit ask, not from the review comments)

### Feature 1 — Company Admin can now edit their own company's profile

Previously `/company/[id]/edit` only exposed `CompanySettingsForm` (theme/date format/currency
display format — operational preferences). Company creation (`CreateCompanyForm`) was also
already intentionally reduced to Company + Company Admin + Financial Year, with a note that full
detail is added afterward via edit — but the "afterward" edit path for a Company Admin never
actually existed for anything beyond those operational settings; only Super Admin's
`/administration/companies/[id]/edit` had the full field set.

Added a middle tier: `companyProfileSchema` (`company-schema.ts`) — every `companySchema` field
**except** the compliance-sensitive registration identifiers (`legalName`, `gstin`, `pan`, `tan`,
`cin`) and the currency ISO code, which remain Super-Admin-only. `companyService
.updateCompanyProfile()` enforces this via `assertPermission(user, "company", "edit")` + a
same-company check, merges the validated subset onto the existing row's untouched
(compliance/currency) fields, and writes through the existing `companyRepository.update()`. New
`CompanyProfileForm` component (reusing the extracted `FormSection` and existing `LogoUpload`) and
`updateCompanyProfileAction` wire it up. `/company/[id]/edit` now renders both this form and the
existing settings form, gated by the permission check described in fix 17 above.

### Feature 2 — Super Admin gets a complete Company Admin edit, not just password/status

`/administration/company-admins` (`CompanyAdminTable`) previously only supported Reset Password
and Activate/Deactivate. Added an "Edit" action opening a username/full name/email/mobile form,
backed by `platformUserService.updateCompanyAdminProfile()` — same TOCTOU-safe
re-validate-inside-transaction pattern as the password-reset/activate-deactivate methods (fix 5),
writes a `company_admin.updated` AuditLog entry, and surfaces username/email uniqueness conflicts
with a friendly message (mirroring `company-service.ts`'s `translateCompanyAdminPersistError`).
`CompanyAdminSummary` gained a `mobile` field to prefill the edit form.

---

## Skipped (verified, still a real concern in general, not worth fixing here)

1. **`prisma/migrations/.../migration.sql` — `CREATE INDEX CONCURRENTLY` / `NOT VALID` FK
   patterns** (both the `User_userType_idx` index and the `Role.companyId` FK/NOT NULL migrations).
   Same reasoning as this codebase's own prior documented skip: these migrations are already
   applied to the persistent local dev database, and per `src/proxy.ts`'s own explicit
   architecture note, this is "a local desktop ERP talking to a local Postgres instance" — the
   lock-duration concern these zero-downtime patterns exist to solve doesn't apply at this scale.
   Revisit if ever deployed against a large, concurrently-written table.
2. **`platform-user-actions.ts` `resetPasswordSchema`'s `.refine({ message: ... })` vs. Zod v4's
   `error` param.** `message` is valid, compiles clean, and is what every other password-complexity
   `.refine()` in this codebase uses (`create-company-schema.ts`, `change-password-schema.ts`,
   `user-schema.ts`). Changing one call site would introduce inconsistency, not fix a defect; a
   codebase-wide `message`→`error` pass should be its own scoped change.
3. **`user-repository.ts` `findAllCompanyAdmins` pagination.** Verified: no list/repository method
   anywhere in this codebase paginates (company list, user list, role list, bank account list,
   ledger list are all unpaginated `findMany`). Adding it to just this one method would be
   inconsistent with the rest of the app for a local, small-scale desktop ERP; a pagination pass,
   if wanted, should touch every list endpoint at once.
4. **`company/select/page.tsx` PLATFORM vs. COMPANY empty-state branch.** Investigated and
   initially implemented, then reverted: `src/proxy.ts` already redirects every PLATFORM
   (Super Admin) session away from any route outside `/administration` and `/profile` before this
   page's component ever renders (`isPlatformAllowedRoute` check). A PLATFORM-specific branch here
   would be dead code — the page's audience is always a COMPANY user in practice.
5. **`prisma/seed.ts` hardcoded password defaults.** Already correctly guarded: both the Super Admin
   and Company Admin bootstrap paths throw if `NODE_ENV === "production"` and the corresponding
   `SEED_*_PASSWORD` env var isn't set, refusing to fall back to the default. The broader ask
   ("staging/QA/preview too") doesn't apply — this project has no such deployment tier; it's a
   single local desktop target per `proxy.ts`'s own stated architecture.

---

## Validation

- `npx tsc --noEmit` — clean, no errors.
- `npx eslint src prisma` — clean, no errors or warnings.
- Both passes were run after all edits above (main pass + the two delegated parallel passes for
  docs and bank-accounts) landed together.
