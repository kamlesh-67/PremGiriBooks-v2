# Super Admin / Company Admin Architecture Migration — Implementation Plan

> This document is the implementation blueprint for
> `architecture-Migration-Super-Admin-Administration.md`. It records the
> concrete design decisions, phase breakdown, and permanent architecture
> principles this migration establishes. Per this project's own precedence
> rule, if a detail here conflicts with the original spec, this document
> wins for implementation purposes (the original spec's business intent is
> unchanged; this doc resolves *how* it's built).

## Context

The original spec (`architecture-Migration-Super-Admin-Administration.md`)
replaces the single-`Administrator` model with a three-tier hierarchy: Super
Admin (Platform) → Company Admin → Company Users. A prior session added the
schema-only foundation (`User.userType`, defaulting everyone to `COMPANY`)
and stopped there. A first pass at a full implementation plan was drafted
and then revised after review — the revisions below are incorporated
directly into the phase breakdown, not left as a separate patch list.

## Permanent Architecture Principles (record these; do not relitigate per-phase)

1. **Only Super Admin is hardcoded.** Every other authorization decision is
   a permission check (`assertPermission`), never a role-name comparison.
   `assertCompanyAdmin()` / `role.name === "Company Admin"` checks are
   **not** used for authorization anywhere in business logic.
2. Business modules never check role names. They only check permissions.
3. Repositories never perform authorization and never branch on
   `userType`/`PLATFORM`/`COMPANY`. That branching lives in Services only.
4. Company initialization always runs through one `TenantBootstrapService`,
   not scattered inline seeding calls.
5. Platform users never have tenant context (no company, financial year, or
   branch — not merely "empty," but never resolved/queried for them at all).
6. Company users always have tenant context.
7. Every business record belongs to exactly one company.
8. Platform/Administration modules and ERP modules remain completely
   separated — no ERP module imports an Administration service, and vice
   versa.
9. No `platform.*` permission catalog exists. Platform has exactly one
   authority check: `assertSuperAdmin()`.
10. System-reserved roles (Company Admin, Accountant, Sales, Purchase,
    Store Manager, Employee) can never be renamed, deleted, or deactivated,
    and can never lose their mandatory permission set — only gain
    permissions beyond it.

### Authorization Hierarchy (the standard flow for every future API)

```
Authenticate User
  -> Resolve User Type
    -> If PLATFORM: assertSuperAdmin() -> Execute
    -> If COMPANY: Resolve Company Context -> Resolve Permissions
                   -> assertPermission() -> Execute
```

---

## Phase 1 — Schema

`prisma/schema.prisma`:

- `User.companyId String?`, `User.roleId String?` (nullable — a `PLATFORM`
  user has neither). Relations become optional.
- `Role` gains: `companyId String` (**required** — every role belongs to
  exactly one company, no shared/global rows survive), `isSystemDefined
  Boolean @default(false)` (this *is* one of the 6 seeded default roles),
  `isProtected Boolean @default(false)` (this role's rename/delete/
  deactivate/mandatory-permission protections are enforced — kept as an
  **independent** flag from `isSystemDefined` rather than derived from it,
  so a future feature could protect a hand-created custom role without
  redefining what "system default" means; today every `isSystemDefined`
  role is seeded with `isProtected: true` and no custom role ever is).
  `@@unique([companyId, name])`, `@@index([companyId])`.
- `Company` gains `roles Role[]` back-relation and `bootstrapVersion Int
  @default(1)` — lets a future ERP upgrade detect a company seeded by an
  older bootstrap version (missing a newer default role/permission/master)
  without a manual migration. Only the column is added now; no
  detect-and-backfill logic is built yet (that's a real future feature, not
  speculative code today).
- New `AuditLog` model, scoped narrowly to the Administration-side events
  this migration itself introduces (not a general retrofit across every
  existing module — that remains the separately-tracked, larger Known
  Implementation Gap): `id, actorUserId, action, targetType, targetId,
  companyId String?, metadata Json?, createdAt`. Write path added only for:
  Tenant/Company Created, Company Activated, Company Deactivated, Company
  Admin Created, Company Admin Password Reset.
- Migration applied via `prisma migrate dev`, sequenced around the Phase 7
  backfill exactly as the original plan described (nullable-required
  two-step for `Role.companyId` against existing data).

## Phase 2 — Auth core: discriminated `CurrentUser`, `SystemContext`, session, proxy

**`src/lib/current-user.ts`** — discriminated union (unchanged from the
original plan):

```ts
interface PlatformCurrentUser { id, username, fullName, userType: "PLATFORM" }
interface CompanyCurrentUser { id, username, fullName, userType: "COMPANY", role: string, companyId: string }
type CurrentUser = PlatformCurrentUser | CompanyCurrentUser
```

- `getCurrentCompanyUser()` narrows to `CompanyCurrentUser`, as before.
- `assertAdministrator()`/`isCurrentUserAdmin()` are replaced by
  `assertSuperAdmin()`/`isCurrentUserSuperAdmin()` (`userType === "PLATFORM"`)
  only. **No `assertCompanyAdmin()` is introduced** — per Principle 1, every
  former "is this an Administrator" business-logic gate becomes a real
  `assertPermission()` call instead (see Phase 3). The only surviving
  hardcoded role-shaped check is `isSystemDefined`/`isProtected` on `Role`
  itself, which governs *role mutability*, not *authorization* — a
  structural distinction worth keeping clear.
- **`getCurrentCompany()`/`getCurrentFinancialYear()` short-circuit to
  `null` immediately for a `PLATFORM` user** (checked before any cookie
  read or DB query) — Principle 5 is enforced at the resolver itself, not
  only via proxy redirects, so a Platform user can never trigger a tenant
  lookup even from code that forgets to check `userType` first.

**New `src/lib/system-context.ts`** — `SystemContext`:
```ts
interface SystemContext {
  user: CurrentUser;
  userType: UserType;
  tenant: TenantContext | null; // null for PLATFORM users
  permissions?: string[];       // resolved lazily, COMPANY users only
}
interface TenantContext {
  company: Company;
  financialYear: FinancialYear | null;
  branch: Branch | null; // always null today — Branch Selection isn't implemented (feature-spec 12)
}
```
`resolveSystemContext()` composes the existing `cache()`-wrapped primitives
(`getCurrentUser`, `getCurrentCompany`, `getCurrentFinancialYear`) into one
object. **Scope decision, stated explicitly rather than silently applied**:
`SystemContext` is introduced as the standard **new code must use going
forward** (`TenantBootstrapService`, the Administration module, and every
service written after this migration). Retrofitting every one of the ~15
pre-existing services (bank-accounts, ledgers, ledger-groups, financial-year,
company-settings, users, roles, permissions, profile) from their current
`await getCurrentUser()` call onto `SystemContext` is a separate, purely
mechanical refactor — bundling it into this already-large migration would
double its blast radius for no behavioral gain (those primitives are already
per-request `cache()`-deduped, so there is no real duplicate-work cost
today). Tracked as a follow-up, not silently dropped.

**`src/lib/session.ts`**: `SessionUser.userType: UserType` added,
`companyId: string | null`.

**`src/proxy.ts`**: branch on `userType` — `PLATFORM` outside
`/administration` (except `/profile`) → redirect to `/administration`;
`COMPANY` inside `/administration` → redirect to `/`. (Route is
`/administration`, not `/platform` — see Phase 6.)

## Phase 3 — Permission-based authorization (replaces role-name gating)

**`src/constants/permissions.ts`**: add a new `"roles"` module (view/create/
edit/delete) — Role Management currently has no dedicated module in the
catalog. Company-scoped capabilities that used to gate on
`assertAdministrator()` now gate on the existing/expanded catalog instead:

| Old gate | New gate |
|---|---|
| `company-service.ts` (settings/view, not legal-info — see Phase 5) | `assertPermission(user, "company", "edit")` |
| `user-service.ts` (`requireAdministrator`) | `assertPermission(user, "users", "create"/"edit"/"delete"/"view")` |
| `role-service.ts` / `permission-service.ts` | `assertPermission(user, "roles", ...)` |

The seeded **Company Admin** role is granted every catalog permission
(unchanged behavior from today's Administrator), so in practice a Company
Admin still passes every one of these checks — the difference is that
authorization now flows through the permission catalog (auditable, and
extensible to a future non-Company-Admin role that also needs, say,
`users.create` without full coverage) rather than a hardcoded name compare.

`src/lib/permissions.ts`'s `hasPermission`/`assertPermission` add
`companyId: user.companyId` to the lookup filter (unchanged from the
original plan — required once `Role.name` is only unique per company) and
are typed to accept `CompanyCurrentUser` only.

## Phase 4 — Role/Permission company-scoping, reserved roles, generalized invariant

**`role-repository.ts`**: every method takes `companyId` (tenant-scoped,
mirroring every other repository in this codebase).

**Reserved-role enforcement** (`role-service.ts`): renaming, deleting, and
deactivating are blocked whenever `existing.isProtected` — not
`DEFAULT_ROLE_NAMES.includes(name)` (removes the last name-based check in
this module). **Mandatory permission set**: each of the 5 non-Company-Admin
reserved roles has a mandatory pair set (`DEFAULT_ROLE_PERMISSIONS`, as
today); `permissionService.setRolePermissions` rejects a submission that
drops any mandatory pair for an `isProtected` role, while still allowing
extra pairs to be added on top. The Company Admin role's mandatory set is
"the entire live catalog" — its permission set is not editable at all
(`setRolePermissions` short-circuits with `AppError` for it).

**Generalized, name-independent invariant** (replaces both the existing
"last Administrator-capable role" and "last active Administrator user"
checks, which today hardcode `role.name === "Administrator"`): a shared
helper (e.g. `src/modules/roles/utils/role-coverage.ts`,
`isFullCoverageRole(tx, roleId)` — permission count === total catalog
count) is reused by:
- `role-repository.ts`'s `deactivate()` — **now effectively unreachable for
  Company Admin specifically**, since `isProtected` already blocks its
  deactivation outright; the full-coverage check remains as the general
  mechanism protecting any *other* role a company might have granted full
  coverage to.
- `user-repository.ts`'s "last active admin" checks in `updateProfile()`/
  `deactivate()` — replaced from `role.name === "Administrator"` to "is this
  user's role a full-coverage role, and are they the last active user
  holding one," which is both name-independent (Principle 1/2) and, in
  practice, always protects the Company Admin seat since that role is
  always full-coverage and can never itself be deactivated.
- Both `otherActiveRoles`/`otherActiveAdministrators` queries add
  `companyId` scoping — the critical cross-tenant fix the original plan
  already flagged (one company's role/user deactivation must never be
  silently gated by another company's roles).

## Phase 5 — `TenantBootstrapService` + Company Creation rewrite

New `src/modules/administration/services/tenant-bootstrap-service.ts`
(single owner of company initialization, per Principle 4):

```ts
tenantBootstrapService.bootstrapTenant(companyId, { financialYear }, tx): Promise<{ companyAdminRoleId: string }>
```
Internally, in order, inside the caller's transaction: seed the 6
per-company reserved roles + their permissions (the logic formerly split
across `permissionService.seedDefaults()`) → create Company Settings (via
existing nested-create in `companyRepository.create`) → create the Financial
Year (extend `financialYearRepository.create` with an optional `tx` param,
same convention as `ledgerRepository.update`'s) → seed Ledger Groups →
seed the default Ledger (both already transaction-aware).

**`company-service.ts#createCompany()`**: gate becomes `assertSuperAdmin()`.
Sequence: create `Company` row → `tenantBootstrapService.bootstrapTenant(...)`
→ create the Company Admin `User` row (extend `userRepository.create` with
an optional `tx` param) using the returned `companyAdminRoleId` → write the
`AuditLog` "Company Created"/"Company Admin Created" entries. One
transaction; a failure at any step rolls back everything, per the original
spec's explicit requirement.

`listCompanies()`/`getCompany()`: `userType === "PLATFORM"` replaces the old
`role === "Administrator"` global-visibility special case.
`updateCompany()`/`activateCompany()`/`deactivateCompany()` (legal/business
info — Platform-only per the original spec's Company Module split) gate on
`assertSuperAdmin()` and write the matching `AuditLog` entries.

`CompanyUser` join-table migration (`User.companyId` direct FK →
`User → CompanyUser → Company`) remains **explicitly deferred**, exactly as
`architecture-context.md`'s existing Known Implementation Gap #1 already
records — this migration does not attempt it. Recorded here again so it
isn't mistaken for silently dropped.

## Phase 6 — Administration module UI (renamed from "Platform")

The module, route prefix, and nav label are **"Administration"**, not
"Platform" — clearer to read for the people who'll actually use this
screen. ("Super Admin"/`userType: PLATFORM"` remain the spec's own
authentication-layer vocabulary; only the user-facing module name changes.)

- `src/modules/administration/` — own repositories/services/actions/
  components, per Principle 8 (no cross-imports with ERP modules).
- **Separate shell components, not a `mode` prop on the existing ones**:
  new `PlatformShell`/`PlatformSidebar` (or `AdministrationShell`/
  `AdministrationSidebar`) rather than parametrizing `AppShell`/`Sidebar`.
  This keeps room for Administration-specific chrome (there's no "current
  company" to show a Super Admin) and avoids threading platform-only
  branching into the ERP shell that every Company User also renders.
- `/administration` hub (Companies, Company Admins, Licenses, Platform
  Settings, Audit, Backup — last four are real nav entries linking to
  "Coming soon" placeholders, per the earlier-confirmed decision).
- `/administration/companies`, `/administration/companies/new` (the full
  Company + Company Admin + Financial Year composite create form),
  `/administration/companies/[id]/edit` (legal/business info, relocated
  from today's `/company/new`+`/company/[id]/edit`).
- `/administration/company-admins` — cross-company list with **Reset
  Password** and **Activate/Deactivate**, each writing the matching
  `AuditLog` entry, gated `assertSuperAdmin()`.

## Phase 7 — Navigation

Separate `PLATFORM_NAV_ITEMS` (Companies, Company Admins, Licenses,
Settings, Audit, Backup) rendered only by `PlatformSidebar`. Existing
ERP `Sidebar`/`NAV_ITEMS` unchanged except its `isAdmin` prop now sources
from a permission check (`hasPermission(user, "settings", "view")` or
equivalent) rather than `isCurrentUserAdmin()`, per Phase 3.
`src/constants/breadcrumbs.ts` gains `administration`, `companies`,
`"company-admins"`, `licenses`, `audit`.

## Phase 8 — Data backfill (one-time, real dev DB)

1. **Permanent seed.ts addition**: bootstrap a Super Admin (`userType:
   PLATFORM`, `companyId`/`roleId: null`) idempotently.
2. **Temporary script (deleted after use)**: per existing company, clone
   the 6 global roles as per-company `Role` rows (`isSystemDefined: true`,
   `isProtected: true`, "Administrator" → "Company Admin"), clone their
   `RolePermission` rows, repoint existing `User.roleId`s, verify zero
   remaining references, then delete the old global `Role`/`RolePermission`
   rows.
3. Apply `Role.companyId` `NOT NULL` only after step 2.

## Phase 9 — Documentation sync

- `context/architecture-context.md`: record the Permanent Architecture
  Principles and Authorization Hierarchy above; resolve Known Gap #2
  (Role/Permission now per-company); explicitly re-affirm Known Gap #1
  (`CompanyUser` join table) as still-deferred (Phase 5 note); add the
  reserved-role list and its rules; add the Platform/ERP module-boundary
  rule (Principle 8).
- `context/progress-tracker.md`: supersede the prior schema-only entries
  from the earlier session with a full Completed entry for this migration;
  record the SystemContext-retrofit deferral as a tracked follow-up (not
  silently dropped).
- Targeted section updates to `06-database-foundation.md`,
  `07-authentication.md`, `08-company-management.md`,
  `10-user-management.md`, `11-role-permissions.md`.

## Verification

Everything from the original plan's verification section, plus:
- A Company Admin action (e.g. creating a user) succeeds via
  `assertPermission`, not a role-name check — confirmed by testing a
  **non**-"Company Admin"-named custom role that's been granted the
  equivalent permissions and behaves identically.
- Attempting to strip a mandatory permission from a reserved role (e.g.
  removing `accounting.view` from Accountant) is rejected; adding an extra
  permission on top succeeds.
- The Company Admin role cannot be deactivated, renamed, or have its
  permissions edited at all.
- `AuditLog` rows are written for Company Created, Company Admin Created,
  Company Activated/Deactivated, and Company Admin Password Reset.
- The "last full-coverage user" invariant is scoped per company and is
  name-independent (verified with a custom full-coverage role, not just
  one literally named "Company Admin").