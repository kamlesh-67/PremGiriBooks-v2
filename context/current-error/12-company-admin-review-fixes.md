# 12 - Company Admin Edit Panel: Review Fixes (Verified Against Live Code)

Pasted review comments (5 findings + 3 nitpicks) against the Super Admin
`/administration/company-admins` "edit Company Admin" panel
(`company-admin-table.tsx`, `platform-user-service.ts`,
`platform-user-actions.ts`) and three unrelated files. Per this project's
established discipline (see `10-review-batch-fixes.md` /
`11-review-batch-fixes-round2.md` — never trust a "fixes applied" claim
without re-reading the live file), every finding below was independently
re-verified against the current code before any fix was applied.

All 8 were confirmed real. None were skipped.

---

## Fixed

1. **Non-atomic Company Admin save** (`company-admin-table.tsx`
   `handleSaveProfile`, `platform-user-service.ts`,
   `platform-user-actions.ts`). Confirmed: `handleSaveProfile` called
   `updateCompanyAdminProfileAction` and, conditionally,
   `reassignCompanyAdminAction` as two separate server actions — two
   separate service calls, two separate transactions. A profile-save
   success followed by a reassignment failure left the admin renamed but
   not moved, with no rollback of the first write. **Fixed**: merged both
   into one `platformUserService.saveCompanyAdmin()` method that runs the
   profile update and the (optional, only-when-`companyId`-changed)
   reassignment — plus both audit-log writes — inside a single
   `runInTransaction(..., SERIALIZABLE_RETRY)` call. New combined
   `saveCompanyAdminSchema` (`companyAdminProfileSchema` + required
   `companyId`) and a single `saveCompanyAdminAction` (one
   `revalidatePath` call) replace the two old schemas/actions. The two old
   service methods (`updateCompanyAdminProfile`, `reassignCompanyAdmin`)
   and their two action wrappers were deleted outright — grepped first to
   confirm no other callers existed anywhere in `src`.
2. **Missing target-company-active check** (`user-repository.ts`
   `reassignCompanyById`). Confirmed: the function checked the target
   company exists (`target_company_not_found`) and has a Company Admin role
   (`target_role_not_found`) but never checked `isActive` — a Super Admin
   could reassign a Company Admin into a deactivated company. **Fixed**:
   added `if (!targetCompany.isActive) return { status:
   "target_company_inactive" }` right after the existing existence check
   (same transaction client already in scope); added the new
   `target_company_inactive` variant to `ReassignCompanyResult`
   (`types/user.ts`) and the matching `case` in `saveCompanyAdmin`'s switch.
3. **React anti-pattern in `toggleEditTarget`** (`company-admin-table.tsx`).
   Confirmed: `setEditTargetId((current) => { ...; setProfileDraft(...);
   return next; })` called `setProfileDraft` as a side effect *inside* the
   `setEditTargetId` updater function — updater functions must stay pure,
   since React can invoke them more than once (Strict Mode, concurrent
   rendering). **Fixed**: `next` is now computed directly from the
   `editTargetId` state variable already in the handler's closure;
   `setEditTargetId(next)` and `setProfileDraft(...)` are now two ordinary,
   separate calls in the handler body, not nested inside an updater.
4. **Missing accessible names** (`company-admin-table.tsx`, the inline
   profile-edit row). Confirmed: the Username/Full name/Email/Mobile inputs
   and the Company select had only `placeholder` text — no accessible name
   for assistive tech once a value is typed (placeholders aren't announced
   as labels and disappear once filled). **Fixed**: added `aria-label` to
   each `Input` and to the `SelectTrigger` (verified `SelectTrigger` spreads
   `...props` onto the real Base UI trigger element, so the attribute
   actually reaches the DOM). Deliberately did **not** add a visible
   `<Label>`/react-hook-form — this component has no form library, and a
   visible label would restructure the existing 5-column single-row grid;
   the original review comment itself offered "matching identifiers OR
   equivalent aria-label attributes" as alternatives.

## Fixed (nitpicks)

5. **`settings/roles/[id]/edit/page.tsx`** called `isCurrentUserCompanyAdmin()`
   after already calling `getCurrentCompanyUser()` — the former internally
   re-calls `getCurrentCompanyUser()` (harmless, `cache()`-deduped, but
   redundant) plus `hasPermission(user, "settings", "view")`. **Fixed**:
   replaced with a direct `hasPermission(user, "settings", "view")` call on
   the already-fetched `user`, matching the identical fix already applied to
   the sibling `accounting/banks/[id]/edit` page in an earlier session.
6. **`normalize-company-input.ts`**'s `normalizeCompanyInput` loop inlined
   the exact same blank-to-null ternary that the file's own `blankToNull()`
   helper (defined immediately below it) already implements. **Fixed**:
   reordered `blankToNull` above `normalizeCompanyInput` and had the loop
   call it instead of duplicating the logic.
7. **`permission-service.ts`**'s `ensureCatalog()` backfill loop awaited
   `permissionRepository.seedRolePermissions` once per company, fully
   sequentially. **Fixed**: fixed-size batches of 5
   (`CATALOG_BACKFILL_BATCH_SIZE`), each batch run with `Promise.all` — no
   new dependency, since `seedRolePermissions` is a stateless
   `createMany({ skipDuplicates: true })` on the plain `prisma` client (not
   a shared transaction), so concurrent calls within a batch carry no
   interaction risk.

## Skipped

None — all 8 findings were confirmed as real issues and fixed.

## Validation

- `npx tsc --noEmit` — clean.
- `npx eslint src prisma` — clean.
- `npx vitest run` — 16/16 passing (unrelated to this change; confirms
  nothing else broke).
- An independent code-reviewer agent pass over the full diff (including the
  unrelated in-flight `runInTransaction`/domain-events refactor already
  present in the working tree) found zero CRITICAL/HIGH/MEDIUM/LOW issues —
  traced `saveCompanyAdmin`'s transaction end-to-end for partial-commit
  paths (none), confirmed `target_company_inactive` is handled everywhere
  `ReassignCompanyResult` is switched over, re-verified via grep that no
  caller of the deleted methods/actions remains, and confirmed the
  `toggleEditTarget` fix preserves every prior interaction (switching edit
  targets, closing via re-click, coexisting with the reset-password row).
