# 03 - Code Review Batch: 9 Findings Verified and Fixed

## Status

All 9 findings verified against current code and resolved (2026-07-11).

Each finding arrived as a "verify first, fix only if still valid, keep changes minimal" review
comment (the same discipline as `00`/`01`/`02`). All 9 were confirmed still present in the code as
described, so all 9 were fixed — none were skipped as stale.

---

## fix1 - Edit page crashes on invalid `CompanySettings` data

**File:** `src/app/company/[id]/edit/page.tsx`

**What the error is:** `settingsDefaults = company.settings ? companySettingsSchema.parse(company.settings) : undefined;` used `.parse`, which **throws** if `company.settings` doesn't match the schema (e.g. a `defaultTheme`/`dateFormat`/`timeFormat` value written before a future schema change, or any other drift between the DB row and the current enum). A thrown error here crashes the whole edit page render — including the Profile tab, which has nothing to do with settings.

**Solution analyzed:** Switch to `.safeParse` and fall back to `undefined` on failure, so a bad settings row degrades to "settings unavailable" instead of taking down the entire page. Chosen — it's the direct, minimal fix; the alternative (auto-repairing the row) is out of scope for a page render.

**Solution applied:**
```diff
- const settingsDefaults = company.settings
-   ? companySettingsSchema.parse(company.settings)
-   : undefined;
+ const settingsParseResult = company.settings
+   ? companySettingsSchema.safeParse(company.settings)
+   : undefined;
+ const settingsDefaults = settingsParseResult?.success ? settingsParseResult.data : undefined;
```

---

## fix2 - Settings tab renders nothing when defaults are unavailable

**File:** `src/app/company/[id]/edit/page.tsx`

**What the error is:** The Settings tab's `{settingsDefaults && (...)}` rendered a blank panel with no explanation whenever `settingsDefaults` was `undefined` — which, after fix1, is now a reachable, non-crashing state instead of a page-wide throw. A silent blank tab is a confusing dead end for the user.

**Solution applied:** Added an `else` branch with a short, honest message instead of nothing:
```diff
  <TabsContent value="settings">
-   {settingsDefaults && (
+   {settingsDefaults ? (
      <CompanySettingsForm companyId={company.id} defaultValues={settingsDefaults} />
+   ) : (
+     <p className="text-sm text-muted-foreground">
+       Company settings are still initializing. Please try again shortly.
+     </p>
    )}
  </TabsContent>
```

---

## fix3 - Non-admins could still open `/company/new`

**File:** `src/app/company/new/page.tsx`

**What the error is:** The page fetched `isAdmin` only to pass it to `AppShell` (which hides the "Masters" sidebar entry) — it never gated the page itself. A non-admin who navigated to `/company/new` directly (typed URL, bookmark, back button) would still see the full create form render, and only discover they're blocked when `createCompanyAction` rejects on submit via `assertAdministrator()`. That's a confusing UX gap and unnecessary information exposure (the form itself), even though the actual mutation was already protected.

**Solution applied:** Redirect before rendering anything:
```diff
+ import { redirect } from "next/navigation";
  ...
  const isAdmin = await isCurrentUserAdmin();
+
+ if (!isAdmin) {
+   redirect("/company");
+ }
```

---

## fix4 - Collapsed sidebar items have no accessible name

**File:** `src/components/layout/sidebar-item.tsx`

**What the error is:** When the sidebar is collapsed, `SidebarItem` renders icon-only and relies entirely on a `Tooltip` for the label. A `Tooltip` typically wires up `aria-describedby`, not an accessible-name-equivalent relationship in every screen reader/browser combination — so a collapsed nav item could announce as an unlabeled button/link to some assistive tech, with no accessible name at all.

**Solution applied:** Set `aria-label={label}` on the rendered `<Link>`/`<button>` whenever `collapsed` is true (left `undefined` when expanded, since the visible `<span>{label}</span>` already provides the accessible name there):
```diff
+ const accessibleLabel = collapsed ? label : undefined;
+
  const button = href ? (
-   <Link href={href} className={itemClassName}>
+   <Link href={href} className={itemClassName} aria-label={accessibleLabel}>
      {content}
    </Link>
  ) : (
-   <button type="button" className={itemClassName}>
+   <button type="button" className={itemClassName} aria-label={accessibleLabel}>
      {content}
    </button>
  );
```

---

## fix5 - Company search input has no accessible name

**File:** `src/modules/company/components/company-search-form.tsx`

**What the error is:** The search `Input` only had a `placeholder`, which most accessibility guidance (and WCAG) explicitly says is not a substitute for a label — placeholder text disappears once the field has a value and isn't reliably exposed as the accessible name across assistive tech.

**Solution applied:** Added `aria-label="Search companies"` alongside the existing placeholder, value, and change handler.

---

## fix6 - Update/activate/deactivate on a missing company threw a raw Prisma 500

**Files:** `src/modules/company/repositories/company-repository.ts`,
`src/modules/company/repositories/company-settings-repository.ts`,
`src/modules/company/services/company-service.ts`,
`src/modules/company/services/company-settings-service.ts`

**What the error is:** `prisma.company.update({ where: { id }, ... })` (used by `update`/`setActive`) and `prisma.companySettings.update(...)` throw `PrismaClientKnownRequestError` with code `P2025` ("Record to update not found") when the target row doesn't exist — e.g. a stale edit-page tab open after the company was concurrently modified elsewhere, or an id typed directly into a URL/action call. That exception propagated unhandled all the way to `company-actions.ts`'s `catch`, which does handle generic `Error`s — so it wasn't a crash — but the message surfaced to the user would have been Prisma's raw internal wording, not a clean domain message, and the failure mode wasn't intentional/tested.

**Solution analyzed:**
1. Catch `P2025` in the repository and return `null`, then have the service layer turn that into a clean thrown `Error("Company not found.")` — keeps the service's public return type non-nullable (no ripple into every caller) while giving actions a proper message via the existing `toErrorMessage()` mapping. **Chosen.**
2. Let a domain-specific error class propagate directly from the repository — more layers know about Prisma-specific concerns than necessary; rejected in favor of keeping Prisma details inside the repository.

**Solution applied:**
- Added `src/modules/company/utils/prisma-errors.ts` — a shared `isRecordNotFoundError(error): boolean` checking `error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025"`, used by both repositories (avoids duplicating the check).
- `companyRepository.update`/`setActive` now `try/catch`, returning `Promise<CompanyWithSettings | null>` (`null` on not-found, rethrow anything else).
- `companySettingsRepository.update` — same pattern, `Promise<CompanySettings | null>`.
- `companyService.updateCompany`/`activateCompany`/`deactivateCompany` now check for `null` and `throw new Error("Company not found.")` — public return types stay `Promise<CompanyWithSettings>` (non-null), so no callers needed to change.
- `companySettingsService.updateSettings` — same pattern, throws `Error("Company settings not found.")`.

**Verified:** called `companyService.updateCompany`/`activateCompany` with a random non-existent UUID — both now reject with `"Company not found."` instead of an unhandled Prisma exception.

---

## fix7 - Non-admin `listCompanies` ignored the status filter

**File:** `src/modules/company/services/company-service.ts`

**What the error is:** The Administrator branch of `listCompanies` passed `filters` straight to `companyRepository.findMany(filters)`, correctly applying `status`. The non-admin branch, however, fetched the user's own company by `companyId` and returned it unconditionally — so a non-admin searching with `status=active` would still see their own company even if it were inactive, and vice versa. Once real (non-Administrator) sessions exist, this is a filter-correctness bug, not just an admin-only edge case.

**Solution applied:**
```diff
  const company = await companyRepository.findById(user.companyId);
- return company ? [company] : [];
+ if (!company) {
+   return [];
+ }
+
+ if (filters.status === "active" && !company.isActive) {
+   return [];
+ }
+
+ if (filters.status === "inactive" && company.isActive) {
+   return [];
+ }
+
+ return [company];
```

(The finding specifically called out the status filter; the `search` filter was intentionally left unapplied for the non-admin branch — a single-company result set makes the search-by-name/GSTIN/mobile filter mostly moot, and the finding didn't ask for it, so it was left out to keep the change minimal.)

**Verified:** created a company, deactivated it, then called `listCompanies({ status: "active" })` as a non-admin scoped to that company (via a temporary `SMOKE_TEST_ROLE`/`SMOKE_TEST_COMPANY_ID` override in the auth stub, reverted immediately after) — returned `[]`; `listCompanies({ status: "inactive" })` returned the one company, as expected.

---

## fix8 - `companySettingsService.getSettings` had no authorization check

**File:** `src/modules/company/services/company-settings-service.ts`

**What the error is:** `companyService.getCompany` is scoped (Administrator, or `company.id === user.companyId`), but the sibling `companySettingsService.getSettings(companyId)` had no such check at all — it would return any company's settings to any caller. Not currently called from anywhere in the app, but it's an exported service method that a future caller (or the next phase) could reasonably use expecting the same protection `getCompany` already has — leaving it open was inconsistent and a live IDOR waiting for a caller.

**Solution applied:** Mirror `getCompany`'s check:
```diff
- getSettings(companyId: string): Promise<CompanySettings | null> {
-   return companySettingsRepository.findByCompanyId(companyId);
- },
+ async getSettings(companyId: string): Promise<CompanySettings | null> {
+   const user = await getCurrentUser();
+   if (user.role !== "Administrator" && user.companyId !== companyId) {
+     return null;
+   }
+
+   return companySettingsRepository.findByCompanyId(companyId);
+ },
```

**Verified:** as a non-admin scoped to one company, `getSettings(ownCompanyId)` returned the row; `getSettings(otherCompanyId)` returned `null`.

---

## fix9 - Regex-based SVG sanitizer replaced with DOMPurify

**File:** `src/modules/company/services/svg-sanitizer.ts`

**What the error is:** The sanitizer added in
[01-base-ui-button-nativebutton-warning.md](01-base-ui-button-nativebutton-warning.md)'s sibling
fix (logo-upload XSS hardening) used hand-written regexes to strip `<script>`, `<foreignObject>`,
event-handler attributes, and dangerous URI schemes. Regex-based HTML/XML sanitization is
well-known to be bypassable — attribute/tag-name casing tricks, unusual whitespace, comments
splitting a tag across matches, nested or malformed markup, and encoding tricks can all defeat
hand-rolled patterns that a real parser wouldn't be fooled by. The original tradeoff (avoid a
heavy dependency in an Electron app) was reconsidered: the sanitizer only runs in the Node-side
Server Action bundle, never in the Electron renderer, so the dependency cost doesn't apply where
it matters.

**Solution analyzed:**
1. Keep hardening the regex approach (more patterns for more bypass tricks) — a losing game long-term against a real parser-based bypass.
2. Replace with **DOMPurify**, configured for server-side (Node) use via `jsdom`, with an explicit `ALLOWED_TAGS`/`ALLOWED_ATTR` allow-list restricted to safe SVG structural elements/attributes, plus `FORBID_TAGS`/`FORBID_ATTR` for extra safety on the well-known active-content vectors. **Chosen** — a battle-tested, structurally-aware sanitizer directly addresses the regex approach's fundamental weakness.

**Solution applied:**
- Installed `dompurify` + `jsdom` (runtime) and `@types/jsdom` (dev; DOMPurify ships its own types).
- Rewrote `sanitizeSvg` to parse and sanitize via `DOMPurify(new JSDOM("").window)`, allow-listing only structural SVG tags (`svg`, `g`, `path`, `circle`, `rect`, `text`, gradients, etc.) and their layout/style attributes, with `script`/`style`/`foreignObject`/`animate*`/`iframe` explicitly forbidden and `ALLOW_DATA_ATTR: false`.
- Kept the existing post-sanitization check that the result still contains an `<svg` root, throwing the same error as before if not — preserved exactly per the finding's instruction.

**Verified:** re-ran the same malicious SVG fixture used to validate the original regex sanitizer
(`<script>`, `onload`/`onclick`, `<foreignObject><script>`, and now also a `<style>` block) through
the new DOMPurify-based `sanitizeSvg` — all stripped, the visible `<circle>` content and `<svg>`
root survived, matching (and slightly exceeding, with the `<style>` case) the original fixture's
coverage.

---

## Validation (all 9 fixes)

- `pnpm exec tsc --noEmit` — clean.
- `pnpm lint` — clean.
- `pnpm build` — succeeds (`next build` + Electron `tsc`).
- Live verification against a running `next dev` + the persistent `docker-compose` Postgres
  (see `00-prisma-postgres-econnrefused.md`): a temporary route exercised the SVG sanitizer, the
  not-found handling on `updateCompany`/`activateCompany` with a random UUID, and — via a
  temporary, immediately-reverted `SMOKE_TEST_ROLE`/`SMOKE_TEST_COMPANY_ID` override of the
  `current-user.ts` stub — the non-admin status-filter and settings-authorization behavior. All
  9 checks passed; the temporary route and the stub override were both removed afterward.
