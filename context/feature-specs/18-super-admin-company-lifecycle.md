# 18 - Super Admin: Company & Company Admin Lifecycle

> **Retroactive spec.** Everything in this document is already implemented — it was originally
> built as part of `architecture-Migration-Super-Admin-Administration.md` (2026-07-13) without a
> dedicated numbered feature-spec. This file gives that slice of the migration a proper home in
> the sequential feature-spec numbering scheme, per explicit user instruction, since
> `08-company-management.md` now only covers the Company Admin's own read-only/operational-settings
> view and no longer describes how a company (or its first Company Admin) actually comes into
> existence. No code changes are made by this file — see the Completed entry in
> `progress-tracker.md` dated 2026-07-13 for what shipped and how it was verified.

## Goal

Document **Company creation, Company legal/business-info editing, and Company Admin account
management** for **Premgiri Books ERP**, all of which are exclusively Super Admin (`userType ===
"PLATFORM"`) capabilities.

The central rule this spec exists to state explicitly: **a Company can never exist without a
Company Admin.** Creating a Company is not a standalone action — it is one atomic workflow that
creates the Company row, seeds its entire chart-of-accounts/roles/financial-year skeleton, and
creates its first Company Admin user, all in a single transaction. There is no "create a company,
add the admin later" path anywhere in this system.

Do **not** implement Financial Year management, Branch selection, Ledger/Accounting modules, or
any Company Admin *operational* capability in this task — those are covered by their own specs
(`08`–`17`) and are unaffected by this one.

---

# Project Context

Before implementation (or before treating this document as authoritative), review

- `architecture-context.md` — specifically the "Multi-Tenant & Governance Architecture" section
  (User Hierarchy, Company Initialization, Authorization Flow)
- `architecture-Migration-Super-Admin-Administration.md` and its companion
  `...-Implementation-Plan.md` — the source design document this spec formalizes
- `08-company-management.md` — the sibling spec covering the Company Admin's own view (operational
  settings, logo) of a company already created via this spec's workflow
- `code-standards.md`
- `progress-tracker.md` — the Completed entry dated 2026-07-13 documents exactly what was built,
  the live verification performed, and the Architecture Decisions this migration established as
  permanent (no `assertCompanyAdmin()`/role-name checks anywhere; only `assertSuperAdmin()` is
  hardcoded; Roles are fully per-company)

---

# Module Responsibilities

This slice of the **Administration** module (`src/modules/administration/`,
`src/app/administration/**`) is responsible for

- Create Company (Company + first Company Admin + default Roles/Financial Year/Ledger Groups/
  default Ledger, atomically)
- Edit Company (legal/business info only)
- Activate Company / Deactivate Company
- List Companies (platform-wide) / View Company
- List Company Admins (platform-wide, one row per company)
- Reset a Company Admin's password
- Activate / Deactivate a Company Admin's own user account

This slice is **not** responsible for

- Company Admin's own operational settings (theme, date format, currency display, logo) — that's
  `08-company-management.md`, reached at `/company/[id]/edit`, gated by
  `assertPermission(user, "company", "edit")`, not this spec's `assertSuperAdmin()`
- Creating a *second* Company Admin for an already-existing company as a distinct action — once
  Company Admin is just a protected, per-company Role, an existing Company Admin can already
  promote another user to it via the ordinary User Management edit-role flow
  (`10-user-management.md`). Deliberately not duplicated here — see Open Questions in
  `progress-tracker.md` if a future requirement specifically wants a Super-Admin-initiated version
  of that action.
- Financial Year management beyond the one Financial Year created during Company Creation
  (`09-financial-year.md` owns everything after that)
- Role/Permission management beyond the default Roles seeded during Company Creation
  (`11-role-permissions.md` owns everything after that)
- Any Licenses/Platform-Settings/Audit-log-viewer/Backup screen — these exist in the
  `/administration` nav as "Coming soon" placeholders only, out of scope for this spec

---

# Features

Implement

- Create Company (Super Admin only)
- Edit Company — legal/business info (Super Admin only)
- View Company (Super Admin: any company; Company Admin: their own company only, per
  `08-company-management.md`)
- Activate Company (Super Admin only)
- Deactivate Company (Super Admin only)
- List Companies, with search and status filter (Super Admin only — platform-wide)
- List Company Admins, one row per company (Super Admin only — platform-wide)
- Reset Company Admin Password (Super Admin only)
- Activate Company Admin / Deactivate Company Admin (Super Admin only)

Do not implement delete. Companies — and the Company Admin user itself — are never permanently
deleted, matching every other master in this codebase.

---

# Data Model

No new tables. This spec operates entirely on models introduced by
`06-database-foundation.md`/`08-company-management.md` (`Company`, `CompanySettings`) and the
Super Admin/Company Admin architecture migration (`User.userType`, `Role.companyId`/
`isProtected`/`isSystemDefined`, `AuditLog`):

```text
enum UserType {
  PLATFORM
  COMPANY
}

model Company {
  id               String   @id @default(uuid())
  ...business/legal/contact/address/financial/branding fields, unchanged from 08...
  bootstrapVersion Int      @default(1)   // future-upgrade hook, not read by anything yet
  isActive         Boolean  @default(true)
  roles            Role[]
  ...
}

model Role {
  id              String   @id @default(uuid())
  companyId       String
  company         Company  @relation(fields: [companyId], references: [id])
  name            String
  isSystemDefined Boolean  @default(false)
  isProtected     Boolean  @default(false)   // true for the "Company Admin" row this spec creates
  isActive        Boolean  @default(true)
  @@unique([companyId, name])
}

model User {
  id        String    @id @default(uuid())
  userType  UserType
  companyId String?   // null only for a PLATFORM user
  roleId    String?   // null only for a PLATFORM user
  ...
}

model AuditLog {
  id           String   @id @default(uuid())
  actorUserId  String
  action       String   // "company.created" | "company_admin.created" | "company.activated" |
                         // "company.deactivated" | "company_admin.password_reset" |
                         // "company_admin.activated" | "company_admin.deactivated"
  targetType   String   // "Company" | "User"
  targetId     String
  companyId    String?
  metadata     Json?
  createdAt    DateTime @default(now())
}
```

`Role.name` is unique **per company**, not globally — every company gets its own private
`"Company Admin"` row (and five other reserved roles), never a shared global row. See
`11-role-permissions.md`'s Completed entry for the full Role/Permission model.

---

# Business Rules

## Company creation always creates its first Company Admin, atomically

Creating a Company is one form, one Server Action, one database transaction, covering:

1. The `Company` row itself (legal/business/contact/address/financial/branding fields — see
   `08-company-management.md`'s Company Information section for the exact field list).
2. A Financial Year (name, start date, end date — same shape as `09-financial-year.md`; must not
   overlap any existing Financial Year for the company, which for a brand-new company can only
   ever be true against itself, but the check runs unconditionally rather than special-casing
   "first year").
3. The six reserved per-company Roles (`Company Admin`, `Accountant`, `Sales`, `Purchase`, `Store
   Manager`, `Employee`) and their default permission grants — see `11-role-permissions.md`.
   `Company Admin` is seeded with full catalog coverage and `isProtected: true`.
4. The default chart-of-accounts skeleton — 23 Ledger Groups and the default "Cash" Ledger — see
   `13-ledger-groups.md`/`14-ledger-master.md`.
5. The **first Company Admin `User` row** — username, full name, email, optional mobile, and a
   password meeting the same complexity policy as every other password field in this app
   (`src/constants/password-policy.ts`) — created with `userType: "COMPANY"`, `roleId` pointing at
   the just-seeded `Company Admin` role.
6. Two `AuditLog` entries (`company.created`, `company_admin.created`).

**If any step fails, the entire company creation rolls back — there is no partially-created
company, no company with roles but no admin, and no company with an admin but no chart of
accounts.** This is enforced by wrapping the whole sequence in one `prisma.$transaction`
(`companyService.createCompany` → `tenantBootstrapService.bootstrapTenant` → the Company Admin
`User` insert → both audit writes).

## Company legal/business-info editing is Super-Admin-only

Editing `companyName`, `legalName`, `displayName`, `businessType`, GSTIN/PAN/TAN/CIN, contact
fields, address fields, or financial-formatting fields (currency/symbol/decimal places) is
Super-Admin-only — a Company Admin cannot change any of these about their own company. This is a
deliberate split from `CompanySettings` (theme/date format/currency display/logo), which remains a
Company Admin capability per `08-company-management.md`.

`companyName`, `legalName`, and `isActive` cannot be edited through this same endpoint as bare
field mutations without going through their own dedicated action (`updateCompany` accepts the full
`companySchema`; activation state is a separate `activateCompany`/`deactivateCompany` call, never a
side effect of `updateCompany`).

## Activate/Deactivate Company

Only a Super Admin may activate or deactivate a Company. An inactive company cannot be selected by
its own users (`08-company-management.md`) and cannot receive new transactions; historical data
remains accessible. Both actions write an `AuditLog` entry (`company.activated`/
`company.deactivated`) in the same transaction as the status change — the audit write and the
state change either both commit or both roll back together, never one without the other.

## Company Admin account management is scoped to Company Admins only

`resetCompanyAdminPassword` and `setCompanyAdminActive` operate **only** on users holding the
`Company Admin` role (`role.isProtected && role.name === "Company Admin"`) — never on an arbitrary
user id, even though both actions are already Super-Admin-gated. Attempting either against a
regular company employee (any other role) or a nonexistent id fails identically with `"Company
Admin not found."`, so the two failure cases are indistinguishable to the caller. Both actions
write an `AuditLog` entry (`company_admin.password_reset` /
`company_admin.activated`/`company_admin.deactivated`) in the same transaction as the mutation.

There is no "create an additional Company Admin for an existing company" action in this module —
see Module Responsibilities above.

## Company-scoped vs. platform-scoped visibility

- **A Super Admin sees every Company and every Company Admin, platform-wide** — the one deliberate
  exception in this codebase to the "company-scoped for every user" default `11-role-permissions.md`
  established, because Company *is* the tenant boundary and the Super Admin's entire job is
  managing tenants.
- **A Company user (any role, including their own Company Admin) only ever sees their own single
  company** — `companyService.listCompanies`/`getCompany` resolve to `[]`/`null` for any id that
  isn't their own `companyId`, never a cross-tenant leak.

---

# Company Service (extends `08-company-management.md`)

```text
src/modules/company/services/company-service.ts
src/modules/administration/services/tenant-bootstrap-service.ts
src/modules/administration/services/platform-user-service.ts
src/modules/administration/validation/create-company-schema.ts
```

Responsibilities added by this spec, on top of `08-company-management.md`'s existing
Create/Update/Get/List/Activate/Deactivate methods:

- `companyService.createCompany(input)` — gated by `assertSuperAdmin()`; runs the full workflow
  above via `tenantBootstrapService.bootstrapTenant()`, inside one transaction.
- `tenantBootstrapService.bootstrapTenant(companyId, { financialYear }, tx)` — the single owner of
  "what does a brand-new company need to exist correctly": Financial Year, Roles + their
  permissions, Ledger Groups, default Ledger. Also the entry point `prisma/seed.ts`'s bootstrap
  script uses for its own "Default Company," so this logic has exactly one implementation, not one
  for the real HTTP path and a second ad hoc one for seeding.
- `platformUserService.listCompanyAdmins()` — gated by `assertSuperAdmin()`; returns one row per
  company (username, full name, email, active status, company name).
- `platformUserService.resetCompanyAdminPassword(userId, newPassword)` /
  `platformUserService.setCompanyAdminActive(userId, isActive)` — both gated by
  `assertSuperAdmin()`, and both re-verify the target is a `Company Admin`-role user before
  mutating (see Business Rules above).

Business logic belongs in these services — never in a Server Action or a component.

---

# Validation

Use Zod. `createCompanySchema` (`src/modules/administration/validation/create-company-schema.ts`)
composes three existing schemas into one form's input shape:

```text
createCompanySchema = {
  company: companySchema        // 08-company-management.md's full field list
  companyAdmin: companyAdminSchema  // username, fullName, email, optional mobile, password
  financialYear: financialYearSchema  // 09-financial-year.md's name/startDate/endDate
}
```

`companyAdminSchema` fields:

- Username — min 3, max 50 characters
- Full Name — min 2, max 100 characters
- Email — required, valid email format, max 150 characters
- Mobile — optional, standard 10-digit Indian mobile format when present
- Password — same complexity policy as every other password field in this app
  (`src/constants/password-policy.ts`): minimum length, maximum length, and a required-complexity
  regex, with a matching human-readable error message

A reset-password action reuses this same password-complexity schema — there is exactly one
password policy definition in this codebase, not one per module.

Provide meaningful validation messages, matching the existing convention on every other module's
Zod schema.

---

# UI

```text
src/app/administration/companies/          (list, per PlatformShell nav)
src/app/administration/companies/new/       (Create Company — company + admin + financial year, one form)
src/app/administration/companies/[id]/edit/ (legal/business info only)
src/app/administration/company-admins/      (platform-wide list — Reset Password, Activate/Deactivate)
```

Reusable components:

```text
src/modules/administration/components/create-company-form.tsx
src/modules/administration/components/company-admin-table.tsx
src/modules/company/components/company-table.tsx     (shared with 08 — see canEdit/canManageStatus below)
src/modules/company/components/company-edit-form.tsx
src/modules/company/components/company-search-form.tsx
```

`CompanyTable` is shared between this spec's `/administration/companies` (Super Admin — full
Edit + Activate/Deactivate) and `08-company-management.md`'s `/company` (Company Admin — Edit only,
pointed at their own operational-settings page, never the status controls). Reuse it via its
`canEdit`/`canManageStatus` boolean props and an `editBasePath` string prop — do not fork a second
copy of this table for either view.

All `/administration/**` pages render inside `PlatformShell`/`PlatformSidebar`
(`src/components/layout/platform-shell.tsx`, `platform-sidebar.tsx`) — a separate shell from the
ERP `AppShell`/`Sidebar`, since a Super Admin has no "current company" and the nav is structurally
different (Companies, Company Admins, Licenses, Settings, Audit, Backup — the last four are
"Coming soon" placeholders, out of scope here).

---

# Security

- Every action in this spec is gated by `assertSuperAdmin()` (`src/lib/current-user.ts`) —
  `userType === "PLATFORM"`, the only hardcoded identity check anywhere in this codebase. Never
  `assertPermission()`, since a Super Admin has no company-scoped Role to check permissions
  against.
- `src/proxy.ts` independently enforces the Platform/Company route split at the middleware layer: a
  `PLATFORM` user is redirected to `/administration` from every route except `/administration/**`
  and `/profile`; a `COMPANY` user is redirected to `/` from anywhere under `/administration`. This
  is a defense-in-depth UX guard, not the authorization boundary itself — Server Actions are
  dispatched independently of route-based middleware, so every service method below re-asserts
  `assertSuperAdmin()` on its own regardless of which page the request appears to come from.
- `resetCompanyAdminPassword`/`setCompanyAdminActive` additionally verify the target user is
  actually a `Company Admin`-role user before mutating (see Business Rules) — closing a scope-creep
  gap where a Super Admin could otherwise reset/deactivate an arbitrary regular employee's account
  by id, exceeding this module's documented "Company Admin management only" capability.
- No mutation may bypass its permission/identity check. No mutation may accept a caller-supplied
  `companyId`/`userId` without independently re-verifying it resolves to something the actor is
  actually allowed to touch.
- Create/Activate/Deactivate actions write an `AuditLog` entry in the **same** transaction as the
  mutation they record — never as a separate, unwrapped statement. A failure between the state
  change and the audit write must roll back both together, not leave the state change committed
  with no audit trail.
- **Known gap**: `companyService.updateCompany` (a plain Company detail edit) currently does
  **not** write an `AuditLog` entry at all — no transaction, no audit row — unlike its three
  siblings (`createCompany`, `activateCompany`, `deactivateCompany`), which all correctly write
  one. This is a real deviation from this section's original blanket claim, not yet closed in
  code; see `architecture-context.md`'s Known Implementation Gaps item 3 for the current, narrow
  scope of `AuditLog` coverage.

---

# Database

Uses the existing `Company`, `CompanySettings`, `Role`, `User`, and `AuditLog` models. No schema
changes are introduced by this spec — all relevant schema changes (`UserType` enum, `Role.companyId`/
`isProtected`/`isSystemDefined`, the `AuditLog` model) were made by the Super Admin/Company Admin
architecture migration this spec formalizes.

If a database is being migrated from before that migration, the migration
`20260713140000_platform_company_split_schema` must include the per-company Role backfill fixed in
`context/current-error/09-platform-company-split-review-fixes.md` (fix1) — the original migration
pair fails on any database that still has pre-split, company-agnostic Role rows.

---

# Code Standards

Follow

- `architecture-context.md`
- `code-standards.md`

Requirements

- Strict TypeScript
- No `any`
- Reusable services
- No business logic in components or Server Actions
- Repository → Service → Server Action → UI architecture
- Every mutating Server Action returns the shared `ActionResult<T>` shape and translates errors via
  `toActionErrorMessage()` (`src/lib/action-error.ts`) — never a raw `Error.message`

---

# Do Not

Do not implement

- Company Admin's own operational settings (theme/date format/currency display/logo) — see
  `08-company-management.md`
- A "create an additional Company Admin for an existing company" action distinct from promoting an
  existing user via User Management's edit-role flow
- Financial Year management beyond the one Financial Year created during Company Creation
- Role/Permission management beyond the six default Roles seeded during Company Creation
- Real Licenses, platform-wide Settings, an Audit Log viewer, or Backup/Restore — these are
  "Coming soon" placeholders in the `/administration` nav only
- Company deletion, or Company Admin user deletion — activate/deactivate only, permanently, for
  both

Those belong to their own already-drafted/implemented specs or to a future, separately-scoped
feature.

---

# Success Criteria

Verify

- A Super Admin can create a Company; a single form submission produces exactly one `Company`, one
  Financial Year, six Roles with their default permission grants, 23 Ledger Groups, one default
  "Cash" Ledger, and one Company Admin `User` — all atomically. A failure at any step (e.g. an
  overlapping Financial Year date range, a duplicate Company Admin username) leaves **no** partial
  company behind.
- A Company Admin `User` created this way can log in immediately and reach their own company's
  `/company` view (operational settings) but not `/administration`.
- A Super Admin can edit a Company's legal/business info; a Company Admin cannot reach that same
  edit screen or mutate those fields through any other endpoint.
- Activate/Deactivate Company both work and each produce exactly one matching `AuditLog` entry,
  committed atomically with the status change.
- Company Admins list shows one row per company, platform-wide; Reset Password and Activate/
  Deactivate both work and each produce exactly one matching `AuditLog` entry, committed atomically
  with the mutation.
- Attempting Reset Password or Activate/Deactivate against a non-Company-Admin user id (or a
  nonexistent id) fails identically with `"Company Admin not found."`
- A Company user (any role) can never list, view, or mutate another company's data through any
  endpoint in this module.
- No TypeScript errors.
- No ESLint errors.

This spec documents already-shipped functionality — see `progress-tracker.md`'s Completed entry
dated 2026-07-13 ("Super Admin / Company Admin architecture migration — completed in full") for the
actual live verification performed (real sessions for both a Super Admin and a Company Admin
against the project's persistent local Postgres container) rather than re-verifying it here.
