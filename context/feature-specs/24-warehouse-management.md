# 24 - Warehouse Management

> Feature-spec file number 24 (spec-file numbers are sequential and never reused). This
> feature is `context/Phases/phase-tracker.md`'s Phase 2 — Core Business Foundation →
> **Inventory Masters** item **#22 Warehouse Management**.

## Goal

Implement **Warehouse Management** for **Premgiri Books ERP** — the master list of physical
stock locations (godowns/stores) that Product Management (tracker #23), the Inventory Engine
(#30), Opening Stock (#44), and Stock Transfer (#46) will reference.

Per `context/Phases/phase-tracker.md`, Warehouse Management depends on **Company + Branch**.

> ⚠️ **Dependency discrepancy to be aware of (recorded in `context/Phases/phase-tracker.md`
> and `context/progress-tracker.md`):** Branch Management (tracker #11,
> `12-branch-management.md`) is marked ✅ in the tracker but was never implemented — only the
> bare `Branch` Prisma table exists (no CRUD, no UI, no branch rows can be created).
> This spec is written so it is **not hard-blocked** by that: the warehouse→branch link is
> optional (see Data Model), mirroring `12-branch-management.md`'s own rule that "a company
> having zero active branches is a valid, fully-supported state." A company with zero
> branches simply creates warehouses with no branch link; the Branch picker appears once
> Branch Management is actually implemented. Confirm with the user whether Branch Management
> should be implemented first — but the spec itself does not require it.

Do **not** implement Category, Brand, HSN, GST Rate, or Product Management in this task
(specs 20–23, 25), and do not implement stock, stock transfer, or any warehouse *selection*
context (see Do Not).

---

# Project Context

Before implementation, review

- PRD.md, project-overview.md, architecture-context.md, code-standards.md, ui-context.md,
  ai-workflow-rules.md, progress-tracker.md
- `context/Phases/phase-tracker.md` (this feature's place in Phase 2 → Inventory Masters)
- `19-unit-management.md` (the template this task mirrors: Repository → Service → Server
  Action → UI, `assertPermission()`, company-scoped reads/writes, Activate/Deactivate
  instead of delete, shared `runAction` envelope in `src/lib/run-action.ts`)
- `12-branch-management.md` (the unimplemented Branch spec — the `Branch` model this task
  optionally links to, and the "zero branches is valid" rule this task extends)
- `09-financial-year.md` / `financial-year-service.ts` (the "only one current" pattern this
  task's `isDefault` rule mirrors)
- `context/progress-tracker.md` Architecture Decision (2026-07-13, item 7): Company,
  Financial Year, and Branch are the **only** application-wide operational contexts — this
  is why there is no "Warehouse Selection" screen or `current-warehouse.ts` in this spec

---

# Module Responsibilities

The Warehouses module is responsible for

- Warehouse Master (Create/Edit/View/Activate/Deactivate, scoped to the active company),
  each optionally linked to a Branch
- A single optional per-company **default warehouse** (the location documents will preselect
  once transactional modules exist)
- A reusable lookup future Product Management and the Inventory Engine read from (active
  warehouses only)

The Warehouses module is **not** responsible for

- Stock, stock levels, bins/racks, or any quantity (Inventory Engine #30, Phase 5)
- Stock Transfer between warehouses (tracker #46)
- Branch CRUD or Branch Selection (`12-branch-management.md`, unimplemented — see Goal)
- A session-level "current warehouse" context (explicitly ruled out by the 2026-07-13
  Architecture Decision above; a warehouse is a document-line attribute, not an
  application-wide context)

---

# Features

Implement

- Create Warehouse
- Edit Warehouse (all fields)
- View Warehouses (list)
- Activate Warehouse
- Deactivate Warehouse
- Set / unset Default Warehouse

Do not implement delete. Matching every other master in this codebase, Warehouses are never
permanently deleted.

**A company having zero warehouses is a valid state** (single-shop businesses may never
create one). Whether at least one warehouse becomes mandatory for stock-bearing documents is
the Inventory Engine's (#30) decision, not this master's.

---

# Data Model

Add to `prisma/schema.prisma` (plus `warehouses Warehouse[]` on `Company` and
`warehouses Warehouse[]` on `Branch`):

```text
model Warehouse {
  id            String   @id @default(uuid())
  companyId     String
  company       Company  @relation(fields: [companyId], references: [id])
  branchId      String?
  branch        Branch?  @relation(fields: [branchId], references: [id])
  name          String
  code          String
  address       String?
  contactNumber String?
  isDefault     Boolean  @default(false)
  isActive      Boolean  @default(true)
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt

  @@unique([companyId, name])
  @@unique([companyId, code])
  @@index([companyId])
  @@index([branchId])
}
```

- `code` — short identifier printed on stock documents (e.g. "WH-MAIN"), unique per company
  independently of `name`, mirroring `Branch.branchCode` and Unit's name/symbol pairing.
- `branchId` — optional. Ties the warehouse to a branch for future branch-wise stock
  reporting. Optional because zero-branch companies are fully supported (see Goal).
- `address` — single free-text field, mirroring `12-branch-management.md`'s identical
  "structured address deliberately deferred" decision. Nothing in scope consumes a
  structured warehouse address.
- `isDefault` — at most one per company (service-enforced, not a DB constraint — Prisma
  cannot express a partial unique index portably; this mirrors how `FinancialYear.isCurrent`
  is already service-enforced).

**No `isSystemDefined` and no seeding — deliberate**, same reasoning as Units. No engine
depends structurally on a warehouse row existing.

---

# Business Rules

- `name` and `code` are each unique within their company (DB-enforced, two composite unique
  constraints). Surface each conflict with a field-specific friendly message.
- `branchId`, when supplied, must reference a branch that belongs to the same company and is
  active at assignment time (server-verified — never trust the client). A branch later
  deactivated does not cascade to its warehouses.
- **At most one default warehouse per company.** Setting `isDefault` on a warehouse clears
  the flag from any other warehouse of that company inside the same transaction (mirroring
  `financial-year-service.ts`'s "only one current" write pattern). Only an **active**
  warehouse can be made default.
- **Deactivating the default warehouse clears its `isDefault` flag in the same
  transaction** — a company may validly have no default. An inactive warehouse must never
  remain the default.
- **All fields remain editable.** Nothing references a warehouse until Product Management /
  the Inventory Engine exist. Forward-compatible rule to record now: once stock movements
  exist, deactivating a warehouse that still holds nonzero stock must be blocked (Inventory
  Engine #30 concern). Nothing to check against yet.
- **Company-scoped for every user.** Derive the active company server-side from the
  requesting user's own session (`getCurrentCompanyUser()`); never accept a company id from
  the client. Treat "belongs to a different company" identically to "not found."

---

# Service / Repository

Create

```text
src/modules/warehouses/repositories/warehouse-repository.ts
src/modules/warehouses/services/warehouse-service.ts
src/modules/warehouses/validation/warehouse-schema.ts
src/modules/warehouses/actions/warehouse-actions.ts
src/modules/warehouses/components/…
src/types/warehouse.ts
```

- `warehouseService`: `listWarehouses(filters)`, `getWarehouse(id)`,
  `createWarehouse(input)`, `updateWarehouse(id, input)`, `activateWarehouse(id)`,
  `deactivateWarehouse(id)`, `setDefaultWarehouse(id)`, `unsetDefaultWarehouse(id)`, and
  `listSelectableWarehouses()` (active only — the lookup Product Management and the
  Inventory Engine will consume).
- Repository mirrors `unit-repository.ts`; the set-default, deactivate, and update paths run
  their read-check-write (and the clear-other-defaults write) inside `runInTransaction`.
- Server Actions use the shared `runAction` envelope (`src/lib/run-action.ts`).

---

# Validation

Zod (`warehouse-schema.ts`):

- Name — required, trimmed, 2–100 characters
- Code — required, trimmed, 2–20 characters
- Branch — optional uuid; server re-verifies company scope and active status
- Address — optional, max 500 characters
- Contact Number — optional, 10-digit format (mirroring `10-user-management.md`'s mobile
  validation)

Create and Update accept the same field set (`isDefault` changes only via the dedicated
set/unset default actions, not via Edit — keeping the one-default invariant in a single code
path).

---

# UI

Pages (under the existing **Masters** hub)

- `/masters/warehouses` — Warehouse list (Name, Code, Branch, Default, Status, Actions)
- `/masters/warehouses/new` — Create Warehouse
- `/masters/warehouses/[id]/edit` — Edit Warehouse

Components (`src/modules/warehouses/components/`): Warehouse Table, Warehouse Form,
Warehouse Edit Form, Warehouse Status Badge, a "Default" badge in the list, and a
Set-as-Default row action.

The Branch field in the form is a combobox over the company's active branches; when the
company has no branches (the normal state until Branch Management is implemented) the field
simply offers no options / renders as "No branches" — not an error.

Wire-up

- Add a "Warehouses" card to the `/masters` hub page (`src/app/masters/page.tsx`), matching
  the existing card convention (lucide `Warehouse` icon).
- Add `warehouses: "Warehouses"` to `src/constants/breadcrumbs.ts`.
- The Sidebar's Masters entry already links to `/masters` — no sidebar change.

The `/masters` hub page's coarse `isCurrentUserCompanyAdmin()` gate remains a known
pre-existing inconsistency, out of scope (recorded in `19-unit-management.md`).

---

# Security

Every action gates via `assertPermission(user, "masters", …)` — `view` for list/detail
reads, `create`/`edit` for writes (set/unset default is an `edit`), and `delete` for
Activate/Deactivate (the documented convention since `ledger-service.ts`). No Permission
catalog changes.

All reads/writes scoped to the requesting user's own company (see Business Rules).

---

# Database

New model: `Warehouse`. New migration. Adds the `warehouses` relation list to `Company` and
`Branch` — no other change to existing tables. No seeding, no bootstrap/domain-event
changes.

---

# Code Standards

Strict TypeScript, no `any`, Repository → Service → Server Action → UI, no business logic in
components, Zod validation at the boundary, Pino logging via the shared error helpers.

---

# Do Not

Do not implement

- Category / Brand / HSN / GST Rate / Product Management (specs 20–23, 25)
- Branch CRUD, Branch Selection, or any part of `12-branch-management.md`
- Stock, stock levels, bins/racks/zones, stock transfer, or any quantity
- A "current warehouse" session context, `current-warehouse.ts`, Status Bar field, or
  selection screen (ruled out by the 2026-07-13 "only three operational contexts"
  Architecture Decision)
- Structured warehouse address fields
- Warehouse-level permissions
- Delete endpoints

---

# Success Criteria

Verify

- Warehouses can be created/edited/listed/activated/deactivated, scoped to the active
  company only, with and without a branch link.
- Duplicate name and duplicate code each produce a field-specific friendly error.
- Setting a default clears the previous default atomically; only one default ever exists per
  company; an inactive warehouse cannot be made default; deactivating the default clears the
  flag.
- A warehouse belonging to another company resolves as "not found" for every operation; a
  branch from another company is rejected.
- A company with zero branches can create and manage warehouses normally.
- No delete is possible anywhere.
- `/masters` hub shows the Warehouses card; breadcrumbs label `/masters/warehouses` as
  "Warehouses".
- `npx tsc --noEmit`, `npx eslint src prisma`, `npx vitest run`, and `next build` all pass.
