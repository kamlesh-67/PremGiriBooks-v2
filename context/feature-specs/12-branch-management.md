# 12 - Branch Management

## Goal

Implement **Branch Management** for **Premgiri Books ERP**.

`06-database-foundation.md` already added a bare `Branch` model (`branchName`, `branchCode`, `address`, `contactNumber`, `gstRegistration`, `isActive`, unique per `(companyId, branchCode)`) with no CRUD, no UI, and no selection mechanism around it. `architecture-context.md` lists Branches as one of the Company module's responsibilities (alongside Company Details, Financial Years, Banks, Company Settings) and calls out "Branch-Level Permissions" under its Security Model. The Top Navbar and Status Bar (`03-Application-Shell.md`) already reserve a "Branch" field that has shown a static `"—"` placeholder since Feature-spec 03, waiting for this.

This task builds the Branch Master (Create/Edit/View/Activate/Deactivate) and a Branch Selection mechanism mirroring Company (`08-company-management.md`) and Financial Year (`09-financial-year.md`) Selection, plus the `current-branch` context helper future business modules will need for branch-scoped operations.

Per `context/Phases/phases.md`, this is Core ERP Platform infrastructure — reusable plumbing every later business module depends on — not a business module itself.

Do **not** implement the business modules (Sales, Purchase, Inventory, Accounting, GST, Reports) that will eventually read branch context, and do **not** implement User-to-Branch assignment or branch-scoped permissions (see Do Not).

---

# Project Context

Before implementation, review

- PRD.md
- project-overview.md
- architecture-context.md
- code-standards.md
- ui-context.md
- ai-workflow-rules.md
- progress-tracker.md
- `06-database-foundation.md` (existing bare `Branch` model)
- `08-company-management.md` (Company Master/Selection pattern this mirrors)
- `09-financial-year.md` (Financial Year Master/Selection pattern this mirrors)
- `11-role-permissions.md` (the company-scoping precedent this reuses — see Business Rules)

Follow all documented architecture and coding standards.

---

# Module Responsibilities

The Branch module is responsible for

- Branch Master (Create/Edit/View/Activate/Deactivate, scoped to the active company)
- Branch Selection (choosing which branch the current session is working in)
- A reusable `current-branch` context helper future business modules will read

The Branch module is **not** responsible for

- Company, Financial Year (already exist — Branch only references `companyId`)
- User accounts, Roles, or Permissions (`10-user-management.md`, `11-role-permissions.md`)
- Assigning users to specific branches, or restricting a user's session to a branch (deferred — see Do Not)
- Branch-level permission granularity in the RBAC model (`11-role-permissions.md` scoped permissions to module+action only; this task does not extend that)
- Any business module that will eventually read branch context (Sales, Purchase, Inventory, Accounting, GST)

---

# Features

Implement

- Create Branch
- Edit Branch
- View Branch
- Deactivate Branch
- Branch Selection screen

Do not implement delete at all. Matching the Company, Financial Year, User, and Role precedent, branches are never permanently deleted. `branchService` exposes no `deleteBranch` method and no delete API route exists — `deactivateBranch` (`isActive = false`) is the only removal path.

Unlike Role's "last active Administrator-capable role" rule or Financial Year's "only one current year" rule, **a company having zero active branches is a valid, fully-supported state** — most companies are single-location and will never create a branch. Deactivating a branch has no special invariant to protect; any active branch, including the last one, can be deactivated freely. Deactivating a branch does not delete or alter anything that may reference it later (no business module references `branchId` yet).

---

# Data Model

No schema changes are required. The existing `Branch` model (`06-database-foundation.md`) already has every field this task needs:

```text
Branch
  id, companyId, branchName, branchCode, address, contactNumber,
  gstRegistration, isActive, createdAt, updatedAt
  @@unique([companyId, branchCode])
```

**Considered and deliberately deferred**: Company's `address` field was split into structured components (`addressLine1/2`, `city`, `state`, `district`, `pinCode`) during `08-company-management.md` specifically because Company documents/reports need structured address data. Branch's `address` stays a single free-text field for now — nothing in this task's scope (or any currently-implemented module) consumes a structured branch address. If a future GST or Sales phase needs branch-level state/PIN code for tax purposes, extend the model then rather than speculatively restructuring it now.

Do not add a `Session.branchId`-style "current branch" flag on the `Branch` model itself (unlike Financial Year's `isCurrent`). Financial Year needs a persisted flag because "the current financial year" has standalone business meaning queried outside any one user's session. "The current branch" has no such meaning — it is purely a per-session working context, exactly like Company Selection, and belongs in a cookie (see `current-branch.ts` below), not a database column.

---

# Business Rules

- A branch's `branchCode` must be unique within its company (already enforced by the schema's `@@unique([companyId, branchCode])`).
- Only Administrator users may Create, Edit, or Deactivate branches.
- **Branch Management is company-scoped for every Administrator, not "Administrator sees everything across companies."** Per the Architecture Decision recorded in `progress-tracker.md` from `11-role-permissions.md`: any module managing an entity that (a) belongs to exactly one company and (b) isn't the Company/tenant-boundary entity itself should default to the company-scoped-for-everyone model `10-user-management.md` established, not the Company/Financial-Year "Administrator sees all" model. A `Branch` belongs to exactly one company and is not the tenant boundary, so an Administrator must only be able to list, read, edit, activate, or deactivate branches belonging to their own company — treat "belongs to a different company" identically to "not found," exactly as `user-service.ts` does. Derive the active company server-side from the requesting Administrator's own session; never accept it as a client-supplied parameter.
- Branch Selection (picking which branch to work in) is available to **any** authenticated user, not Administrator-only — this mirrors Company Selection and Financial Year Selection, which are both accessible to every logged-in user, not just admins.
- A branch must belong to the currently active company; selecting a branch belonging to a different company must be rejected.

---

# Branch Selection

Mirror `08-company-management.md`'s Company Selection and `09-financial-year.md`'s Financial Year Selection screens, with one deliberate difference: **Branch Selection is optional, not mandatory.**

- If the active company has **zero** branches, skip Branch Selection entirely — proceed straight through, exactly as if a branch had been selected. `getCurrentBranch()` resolves to `null`, which is a normal, valid state, not an error condition requiring a redirect (unlike a missing Company or Financial Year, both of which do redirect).
- If the active company has **exactly one active** branch, auto-select it (no click needed), matching Company/Financial Year Selection's existing auto-select behavior.
- If the active company has **two or more active** branches and none is yet selected for this session, show the manual picker (`/branch/select`, a grid of `BranchCard`s, mirroring `CompanySelector`/`FinancialYearSelector`).
- Only active branches are offered for selection.
- Slot this check into the existing redirect chain in `src/app/page.tsx`, after the Financial Year check: `/` → (no company) `/company/select` → (no financial year) `/financial-year/select` → (company has 2+ branches, none selected) `/branch/select` → render.
- Switching companies (via Company Selection) must clear any previously selected branch, the same way it should already be considered when switching companies affects financial year context — a branch selected under one company must never silently persist into a different company's session.

---

# Branch Service

Create

```text
src/modules/branch/services/branch-service.ts
```

Responsibilities

- Create/Update/List/Deactivate/Activate Branch, company-scoped per the Business Rules above
- List selectable (active) branches for the current company, for the Branch Selection screen

Business logic belongs here, following the Repository → Service → UI layering already established in the Company, Financial Year, User, and Role modules.

---

# Validation

Use

Zod

Validate

- Branch Name (required, min length)
- Branch Code (required, min length — uniqueness is DB-enforced per company)
- Contact Number (optional, 10-digit format, mirroring `10-user-management.md`'s mobile validation)
- GST Registration (optional, GSTIN format, mirroring `08-company-management.md`'s GSTIN validation)

Provide meaningful validation messages.

---

# UI

Create

```text
src/app/branch
src/app/branch/select
```

Pages

- Branch List (`/branch`)
- Create Branch (`/branch/new`)
- Edit Branch (`/branch/[id]/edit`)
- Branch Selection (`/branch/select`)

Create reusable components

```text
src/modules/branch/components/
```

Examples

- Branch Form
- Branch Table
- Branch Status Badge
- Branch Selector (mirrors `CompanySelector`/`FinancialYearSelector`)
- Branch Card

---

# Context Helper

Create

```text
src/lib/current-branch.ts
```

Mirror `current-company.ts`'s read/write split exactly:

- `getCurrentBranchId`/`getCurrentBranch` — read-only, `cache()`-wrapped, safe to call from any Server Component. Validates the resolved branch belongs to the active company (via `getCurrentCompany()`), the same way `getCurrentFinancialYear()` validates against the active company. Resolves to `null` on any mismatch or when no branch is selected — never throws for "no branch," since that is a normal state (see Branch Selection above).
- `setCurrentBranch`/`clearCurrentBranch` — write a separate httpOnly cookie (add `ACTIVE_BRANCH_ID` to `src/constants/cookie-keys.ts`); only callable from inside a Server Action, never during Server Component render, per this project's established Next.js 16 cookie-write rule.
- Add a `BranchProvider` (`src/components/providers/branch-provider.tsx`) mirroring `CompanyProvider`/`FinancialYearProvider` exactly, nested inside them in `src/app/layout.tsx`. Wire `StatusBar`'s existing "Branch" field (currently a static `"—"` placeholder) to `useBranch()`.

---

# Navigation

Add Branch Management under

```text
Masters
```

alongside Company Management and Financial Year Management — Branches are Company-family master data per `architecture-context.md`, not Settings/security infrastructure like Users or Roles. Add a third card to the existing `/masters` hub page (`src/app/masters/page.tsx`).

The Sidebar's "Masters" entry is unchanged (already links to `/masters`).

---

# Security

Only Administrator users may

- Create, Edit, Deactivate branches

Any authenticated user may

- Select a branch from their own company's active branches

Branch reads/writes must be scoped to the requesting Administrator's own company (see Business Rules) — never accept a company id from the client.

---

# Database

No new models. Extend nothing. `Branch` (`06-database-foundation.md`) is used as-is.

---

# Code Standards

Follow

- architecture-context.md
- code-standards.md

Requirements

- Strict TypeScript
- No `any`
- Reusable services
- No business logic in components
- Repository → Service → UI architecture

---

# Do Not

Do not implement

- Sales
- Purchase
- Inventory
- Accounting
- GST
- Reports
- User-to-Branch assignment or restricting a user's session/permissions to a specific branch (mirrors `07-authentication.md`'s and `10-user-management.md`'s identical "Branch Assignment" deferral — still deferred here)
- Branch-level permission granularity in the RBAC model (`11-role-permissions.md` explicitly scoped permissions to module+action only)
- Structured branch address fields (see Data Model's "considered and deliberately deferred" note)
- A persisted "current branch" flag on the `Branch` model

Those belong to future implementation tasks.

---

# Success Criteria

Verify

- Branches can be created, edited, and deactivated, scoped to the active company only (an Administrator cannot read or modify another company's branches).
- No branch can be permanently deleted.
- A company with zero branches works normally with no forced selection step.
- A company with exactly one active branch auto-selects it with no click.
- A company with two or more active branches shows a manual picker, and only active branches are selectable.
- Switching the active company clears any previously selected branch.
- The Status Bar's "Branch" field shows the real selected branch name instead of the `"—"` placeholder.
- No TypeScript errors.
- No ESLint errors.

Feature-spec 12 (this spec) falls under `context/Phases/phases.md`'s **Phase 02 — Core ERP Platform**, same as `11-role-permissions.md`. Completing this spec does not complete Phase 01: Foundation (`07-authentication.md` remains deliberately deferred) nor Phase 02 (Company Settings, Document Numbering Engine, Audit Log Engine, Backup & Restore, Import Framework, Export Framework, File Manager, and Notification System all remain undrafted). The next feature-spec (numbered 13 onward) should be scoped from `phases.md`'s remaining Phase 02 items when that work is explicitly started, not drafted speculatively ahead of time.
