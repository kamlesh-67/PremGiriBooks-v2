# 09 - Platform/Company Split Review: 4 Findings Verified and Fixed

## Status

All 4 findings verified against current code and resolved (2026-07-13).

These arrived from a 3-way parallel review (security-reviewer, typescript-reviewer, database-reviewer)
of the uncommitted platform/company split + bank accounts changeset, triggered by an observed
`GET /company/new 404` in the dev server log. Each finding below was independently re-verified against
the actual code/schema/migration files (and, for the migration fix, against a real database) before
being fixed — same "verify first, fix only if still valid" discipline as `03-code-review-batch-fixes.md`.

Two additional MEDIUM findings from the same review (Super Admin actions not validating the target
user is actually a Company Admin) are fixed as part of fix4 below, since they live in the same file and
function as the audit-transaction fix.

---

## fix1 - `Role.companyId` NOT NULL migration had no backfill — fails on any pre-existing database

**Files:** `prisma/migrations/20260713140000_platform_company_split_schema/migration.sql`

**What the error is:** The pre-split schema had one global `Role` row per name (e.g. `Company Admin`,
`Accountant`) shared across every company. Migration `20260713140000_...` adds `Role.companyId` as
**nullable**, and the very next migration, `20260713150000_role_company_required`, immediately runs
`ALTER TABLE "Role" ALTER COLUMN "companyId" SET NOT NULL`. Nothing in between populates `companyId`
for the pre-existing global rows — that backfill was done by a one-off script that, per
`context/feature-specs/architecture-Migration-Super-Admin-Administration-Implementation-Plan.md`
("Phase 8 — Data backfill"), was **deleted after use** and never became part of the migration history.

**Reproduced:** created a scratch database, applied every migration up to (not including)
`20260713140000_...`, seeded fixture data matching the actual pre-split shape (two companies sharing
two global `Role` rows, `RolePermission` grants on one of them, three `User` rows pointing at the
shared roles) — then applied the two migrations as originally written. Confirmed this reproduces the
failure: `ALTER COLUMN "companyId" SET NOT NULL` aborts with `column contains null values` because the
newly-added `companyId` column is still `NULL` on every pre-existing role. Any teammate's clone, a CI
database, or a staging/prod database carried over from before this branch hits this on `prisma migrate
deploy`.

**Solution analyzed:**
1. Re-derive the deleted one-off backfill script and ask everyone to run it manually before deploying —
   rejected; migration history must be replayable from scratch on any environment without an
   out-of-band manual step that can be forgotten or lost again.
2. Add the backfill as committed SQL inside migration `20260713140000_...` itself, before
   `20260713150000_...` enforces `NOT NULL`. **Chosen** — the standard Prisma pattern for a schema
   change that requires a data migration; keeps history correct and self-contained.

**Solution applied:** Added a `DO $$ ... END $$;` block to
`20260713140000_platform_company_split_schema/migration.sql`, after the `Role_companyId_name_key`
index is created and before the FK re-adds. For every existing `Company`, and for every still-global
(`companyId IS NULL`) `Role`, it:
- Clones the role as a new per-company row (`INSERT ... ON CONFLICT ("companyId", "name") DO NOTHING`,
  so a same-named role already seeded post-split for that company is reused instead of duplicated),
- Copies that role's `RolePermission` grants onto the resolved per-company row,
- Repoints every `User` in that company from the legacy role to the resolved per-company role,
- and finally deletes the now-superseded global `Role`/`RolePermission` rows.

A fresh/empty database has no `Company` rows and no `companyId IS NULL` `Role` rows, so every loop body
is a no-op — safe for both a brand-new install and a database carried over from before the split.

```sql
DO $$
DECLARE
  company_row RECORD;
  legacy_role RECORD;
  resolved_role_id TEXT;
BEGIN
  FOR company_row IN SELECT id FROM "Company" LOOP
    FOR legacy_role IN SELECT * FROM "Role" WHERE "companyId" IS NULL LOOP
      INSERT INTO "Role" (
        "id", "companyId", "name", "isSystemDefined", "isProtected",
        "isActive", "createdAt", "updatedAt"
      )
      VALUES (
        gen_random_uuid()::TEXT, company_row.id, legacy_role.name,
        legacy_role."isSystemDefined", legacy_role."isProtected",
        legacy_role."isActive", legacy_role."createdAt", now()
      )
      ON CONFLICT ("companyId", "name") DO NOTHING;

      SELECT id INTO resolved_role_id FROM "Role"
        WHERE "companyId" = company_row.id AND "name" = legacy_role.name;

      INSERT INTO "RolePermission" ("id", "roleId", "permissionId", "createdAt")
      SELECT gen_random_uuid()::TEXT, resolved_role_id, rp."permissionId", rp."createdAt"
      FROM "RolePermission" rp
      WHERE rp."roleId" = legacy_role.id
      ON CONFLICT ("roleId", "permissionId") DO NOTHING;

      UPDATE "User"
      SET "roleId" = resolved_role_id
      WHERE "roleId" = legacy_role.id AND "companyId" = company_row.id;
    END LOOP;
  END LOOP;

  DELETE FROM "RolePermission" WHERE "roleId" IN (SELECT id FROM "Role" WHERE "companyId" IS NULL);
  DELETE FROM "Role" WHERE "companyId" IS NULL;
END $$;
```

`gen_random_uuid()` is built into Postgres 16 (the project's `docker-compose.yml` pins
`postgres:16-alpine`), so no `pgcrypto` extension is required.

**Verified:**
- Re-ran the exact reproduction above (fresh scratch DB, pre-split fixture, then both migrations) with
  the fix in place — both migrations now apply successfully.
- Confirmed the result: each company got its own clone of every previously-shared role, every user was
  repointed to their own company's clone (not the other company's), the `Company Admin` role's
  `RolePermission` grant was correctly cloned onto **both** per-company copies, and the legacy
  `companyId IS NULL` rows were gone before the `NOT NULL` constraint was applied.
- Re-ran `npx prisma migrate status` against the actual local dev database afterward — still reports
  "Database schema is up to date!" (this local DB already had correctly-split, `companyId`-populated
  roles for all 4 existing companies before this fix, so editing the migration file did not require any
  changes to this DB's state — the fix only matters for *other* environments deploying from scratch).

---

## fix2 - `GET /company/new 404` — stale link to a deleted route

**File:** `src/app/company/select/page.tsx`

**What the error is:** This changeset moved company creation to
`/administration/companies/new` (Super-Admin-only) and deleted `src/app/company/new/page.tsx`, but the
empty-state ("no companies yet") branch of `/company/select` still rendered a "Create Company" button
linking to the now-deleted `/company/new`. Since `companyService.listCompanies` scopes a COMPANY user to
their own single company, this empty state is reached when that company has been deactivated — not when
no company exists. And since COMPANY users are blocked from `/administration` entirely by `proxy.ts`,
simply repointing the link to `/administration/companies/new` would have been wrong too: a COMPANY user
genuinely has nothing to create here anymore.

**Solution applied:** Replaced the dead CTA with an explanation and a Sign Out action:
```diff
- import Link from "next/link";
-
  import { Button } from "@/components/ui/button";
  import { companyService } from "@/modules/company/services/company-service";
  import { CompanySelector } from "@/modules/company/components/company-selector";
+ import { logoutAction } from "@/lib/auth-actions";

  export default async function CompanySelectPage() {
    const companies = await companyService.listCompanies({ status: "active" });

    if (companies.length === 0) {
      return (
        <main ...>
-         <h1 ...>No companies yet</h1>
-         <p ...>Create your first company to get started with Premgiri Books ERP.</p>
-         <Button nativeButton={false} render={<Link href="/company/new">Create Company</Link>} />
+         <h1 ...>No active company</h1>
+         <p ...>
+           Your company is not currently active. Please contact your Super Admin to restore access.
+         </p>
+         <form action={logoutAction}>
+           <Button type="submit">Sign Out</Button>
+         </form>
        </main>
      );
    }
```

**Verified:** `tsc --noEmit` and `eslint` both clean; confirmed no other route in the app links to
`/company/new` (`grep -rn "company/new"` returns only this now-fixed spot).

---

## fix3 - Company Admin lost access to their own Company Settings/logo page

**Files:** `src/modules/company/components/company-table.tsx`,
`src/app/company/page.tsx`, `src/app/administration/companies/page.tsx`

**What the error is:** `CompanyTable` gained a single `canManage` boolean gating its entire Actions
column — both the Edit link (to `/company/[id]/edit`) and the Activate/Deactivate buttons. But those
two things are not the same operation: Activate/Deactivate calls
`companyService.activateCompany`/`deactivateCompany`, which correctly asserts `getCurrentSuperAdmin()`
— genuinely Super-Admin-only. The Edit link, however, points at `/company/[id]/edit`, which since this
same changeset is the **Company Admin's own operational-settings screen** (theme, date format,
currency display, logo) — separate from Super Admin's legal/business-info screen at
`/administration/companies/[id]/edit`. `src/app/company/page.tsx` (the Company Admin's own `/company`
view) rendered `<CompanyTable companies={companies} />` with no `canManage`, so it defaulted to `false`
— hiding the Edit link along with the (correctly Super-Admin-only) Activate/Deactivate buttons. With no
other UI path to `/company/[id]/edit`, a Company Admin could no longer reach their own company's
operational settings or upload/change their logo through any UI element.

**Solution analyzed:**
1. Pass `canManage={isAdmin}` on the Company Admin's page — rejected; it would also expose the
   Super-Admin-only Activate/Deactivate buttons on the Company Admin's own company row, since
   `canManage` gates both together.
2. Split the single `canManage` prop into two independent props — `canEdit` (Edit link) and
   `canManageStatus` (Activate/Deactivate + the empty-state "Create Company" CTA). **Chosen** — matches
   the two genuinely different authorization scopes documented in `company-service.ts`
   (`getCurrentSuperAdmin()` for activate/deactivate) vs. the Company Admin's own edit access.

**Solution applied:**
```diff
  interface CompanyTableProps {
    companies: CompanyWithSettings[];
-   canManage?: boolean;
+   canManageStatus?: boolean;
+   canEdit?: boolean;
    editBasePath?: string;
  }

  export function CompanyTable({
    companies,
-   canManage = false,
+   canManageStatus = false,
+   canEdit = false,
    editBasePath = "/administration/companies",
  }: CompanyTableProps) {
    ...
-   {canManage && <TableHead className="text-right">Actions</TableHead>}
+   {(canEdit || canManageStatus) && <TableHead className="text-right">Actions</TableHead>}
    ...
-   {canManage && (
+   {(canEdit || canManageStatus) && (
      <TableCell className="text-right">
        <div className="flex justify-end gap-2">
-         <Button ... render={<Link href={`${editBasePath}/${company.id}/edit`}>...</Link>} />
-         <Button ... onClick={() => handleToggleActive(company)}>...</Button>
+         {canEdit && (
+           <Button ... render={<Link href={`${editBasePath}/${company.id}/edit`}>...</Link>} />
+         )}
+         {canManageStatus && (
+           <Button ... onClick={() => handleToggleActive(company)}>...</Button>
+         )}
        </div>
      </TableCell>
    )}
```

Call sites updated accordingly:
- `src/app/company/page.tsx` (Company Admin's own view):
  `<CompanyTable companies={companies} canEdit={isAdmin} editBasePath="/company" />` — reuses the
  page's existing `isAdmin` (`isCurrentUserCompanyAdmin()`) check, and points the Edit link at the
  correct operational-settings route.
- `src/app/administration/companies/page.tsx` (Super Admin's view):
  `<CompanyTable companies={companies} canManageStatus canEdit editBasePath="/administration/companies" />`
  — unchanged behavior, both Edit and Activate/Deactivate remain available here.

Note: the actual mutation this Edit link leads to
(`companySettingsService.updateSettings` → `assertPermission(user, "company", "edit")`) was already
correctly permission-gated independent of this UI link's visibility — this fix restores the link, it
does not change any authorization boundary.

**Verified:** `tsc --noEmit` and `eslint` both clean. Confirmed by reading the resulting component: on
`/company`, a Company Admin's row now renders only the Edit pencil (no Activate/Deactivate); on
`/administration/companies`, a Super Admin's row renders both.

---

## fix4 - Audit log not transactional with the state change; Super Admin actions didn't verify target is a Company Admin

**Files:** `src/modules/company/services/company-service.ts`,
`src/modules/company/repositories/company-repository.ts`,
`src/modules/administration/services/platform-user-service.ts`,
`src/modules/users/repositories/user-repository.ts`

**What the error is (transactionality):** `companyService.activateCompany`/`deactivateCompany` called
`companyRepository.setActive(id, ...)` and then, as a separate unwrapped statement, `auditLogService
.record({...})` against the default `prisma` client — not the same transaction. Same pattern in
`platformUserService.resetCompanyAdminPassword`/`setCompanyAdminActive`: the mutation
(`updatePasswordHash`/`setActiveById`) committed first, the audit write ran afterward independently.
Only `companyService.createCompany` did this correctly (passing a shared `tx` through to both the
mutation and `auditLogService.record`). A failure between the two steps (transient DB error, connection
drop) leaves the state change committed with **no corresponding audit trail entry** — directly
undermining the audit requirement this same migration introduces.

**What the error is (target validation):** `resetCompanyAdminPassword` and `setCompanyAdminActive`
looked up the target purely by `userId` via `userRepository.findById`/`setActiveById`, with no check
that the target is actually a Company Admin — unlike `findAllCompanyAdmins()` (the read path backing
this same UI screen), which filters on `role.isProtected && role.name === COMPANY_ADMIN_ROLE_NAME`.
Since these actions are already Super-Admin-only, this isn't a privilege-escalation bug, but it does
exceed the service's own documented scope ("Super-Admin-only, cross-company **Company Admin**
management") — a Super Admin who obtains any regular employee's user id could reset that employee's
password or deactivate their account, not just a Company Admin's.

**Solution applied:**

1. `companyRepository.setActive` now accepts an optional transaction client (same pattern already used
   by `companyRepository.create`):
   ```diff
   - async setActive(id: string, isActive: boolean): Promise<CompanyWithSettings | null> {
   -   return prisma.company.update({ where: { id }, data: { isActive }, ... });
   + async setActive(
   +   id: string, isActive: boolean, client: PrismaClientOrTransaction = prisma
   + ): Promise<CompanyWithSettings | null> {
   +   return client.company.update({ where: { id }, data: { isActive }, ... });
   ```

2. `companyService.activateCompany`/`deactivateCompany` now wrap the status change and its audit write
   in one `prisma.$transaction`:
   ```diff
     async activateCompany(id: string): Promise<CompanyWithSettings> {
       const actor = await getCurrentSuperAdmin();
   -   const company = await companyRepository.setActive(id, true);
   -   if (!company) throw new AppError("Company not found.");
   -   await auditLogService.record({ ... });
   -   return company;
   +   return prisma.$transaction(async (tx) => {
   +     const company = await companyRepository.setActive(id, true, tx);
   +     if (!company) throw new AppError("Company not found.");
   +     await auditLogService.record({ ... }, tx);
   +     return company;
   +   });
     },
   ```
   (`deactivateCompany` mirrors this exactly.)

3. `userRepository.updatePasswordHash` and `userRepository.setActiveById` now accept an optional
   transaction client the same way.

4. `platformUserService.resetCompanyAdminPassword`/`setCompanyAdminActive` now: (a) fetch the target via
   `findById`, assert `role.isProtected && role.name === COMPANY_ADMIN_ROLE_NAME` via a new
   `assertIsCompanyAdmin` helper — throwing the same `"Company Admin not found."` error a nonexistent id
   would, so the observable behavior doesn't leak which case occurred — and (b) wrap the mutation +
   audit write in one `prisma.$transaction`:
   ```ts
   function assertIsCompanyAdmin(user: UserWithRole): void {
     if (!user.role.isProtected || user.role.name !== COMPANY_ADMIN_ROLE_NAME) {
       throw new AppError("Company Admin not found.");
     }
   }

   async resetCompanyAdminPassword(userId: string, newPassword: string): Promise<void> {
     const actor = await getCurrentSuperAdmin();
     const user = await userRepository.findById(userId);
     if (!user) throw new AppError("Company Admin not found.");
     assertIsCompanyAdmin(user);

     const passwordHash = await hashPassword(newPassword);
     await prisma.$transaction(async (tx) => {
       await userRepository.updatePasswordHash(userId, passwordHash, tx);
       await auditLogService.record({ ... }, tx);
     });
   },
   ```
   (`setCompanyAdminActive` mirrors this, checking the target before opening the transaction and
   re-fetching inside it via `setActiveById`.)

**Verified:** `tsc --noEmit` and `eslint` both clean across all four touched files. Read the resulting
call chains end-to-end to confirm every mutation + its audit write now share one `tx`, and that a
non-Company-Admin `userId` is rejected by `assertIsCompanyAdmin` before any write is attempted.

> **Pointer (added later):** the transaction-sharing fix above is still accurate for what it
> covers, but it does not close a separate TOCTOU window — the Company Admin role check happens
> once, before the transaction opens, so a concurrent role change in that gap goes undetected. The
> actual code-level fix (re-validating the target's role *inside* the transaction, under
> Serializable isolation) is tracked and re-applied in
> `context/current-error/11-review-batch-fixes-round2.md`, touching
> `src/modules/administration/services/platform-user-service.ts` and
> `src/modules/users/repositories/user-repository.ts`. This file is left as-is otherwise, an
> accurate historical record of what shipped at the time.

---

## Validation (all 4 fixes)

- `npx tsc --noEmit` — clean, no errors.
- `npx eslint src` — clean, no errors or warnings.
- `npx prisma validate` — schema valid.
- Migration fix (fix1) reproduced and re-verified end-to-end against real Postgres 16 databases:
  1. Created a scratch database (`premgiri_migtest`), applied migrations up to (not including) the two
     new ones, seeded fixture data matching the actual pre-split shape, confirmed the *original*
     (unfixed) migration pair fails with `column "companyId" contains null values`.
  2. Re-seeded the same scratch database, applied the two migrations *with* the fix — both succeeded.
  3. Queried the result: correct per-company role clones, correct per-user role repointing (each user's
     `roleId` resolves to a role owned by that same user's `companyId` — verified with an explicit
     `User JOIN Role WHERE companyId != companyId` query returning zero rows), correctly cloned
     `RolePermission` grants, and zero leftover `companyId IS NULL` role rows.
  4. Dropped the scratch database and removed all temporary verification scripts afterward.
  5. Re-ran `prisma migrate status` against the real local dev database — unaffected, still
     "up to date" (this DB's roles were already correctly per-company before the fix).
