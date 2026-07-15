# 19 - Unit Management

> Feature-spec file number 19 because 18 is already taken by the separately-scoped
> `18-super-admin-company-lifecycle.md` (spec-file numbers are sequential and never reused —
> see `context/progress-tracker.md`). This feature is `context/Phases/phase-tracker.md`'s
> Phase 2 — Core Business Foundation → **Inventory Masters** item **#17 Unit Management**.
> The working git branch was created by the user as `18-Unit-Managemen`; branch names do not
> participate in the spec-file numbering scheme.

## Goal

Implement **Unit Management** for **Premgiri Books ERP** — the first Inventory Masters
feature: the master list of units of measure (Pieces, Kilograms, Litres, Boxes, …) that
Product Management (tracker #23), the Inventory Engine (#30), and every stock-bearing
document (Sales/Purchase invoices, stock adjustments) will later reference.

Per `context/Phases/phase-tracker.md`, Unit Management depends only on Database Foundation.
It introduces the first new table since the Accounting Foundation group; unlike Expense/Income
Heads (which were scoped views over `Ledger`), a Unit is a genuinely new entity.

Do **not** implement Category, Brand, HSN, GST Rate, Warehouse, or Product Management in this
task, nor compound units / unit conversion (see Do Not).

---

# Project Context

Before implementation, review

- PRD.md, project-overview.md, architecture-context.md, code-standards.md, ui-context.md,
  ai-workflow-rules.md, progress-tracker.md
- `context/Phases/phase-tracker.md` (this feature's place in Phase 2 → Inventory Masters)
- `13-ledger-groups.md` / `14-ledger-master.md` (the company-scoped-master pattern this task
  mirrors: Repository → Service → Server Action → UI, `assertPermission()`, company-scoped
  reads/writes, Activate/Deactivate instead of delete)
- The Architecture Decisions entries in `progress-tracker.md` dated 2026-07-13 (company-scoped
  authorization is the default; every module gates on `assertPermission()`, never a hardcoded
  Administrator check)

---

# Module Responsibilities

The Units module is responsible for

- Unit Master (Create/Edit/View/Activate/Deactivate, scoped to the active company)
- A reusable lookup future Product Management reads from (active units only)

The Units module is **not** responsible for

- Products, stock, or any quantity arithmetic (Product Management #23, Inventory Engine #30)
- Compound units / conversion factors (e.g. 1 Box = 12 Pieces) — deferred until Product
  Management proves the need (YAGNI)
- GST returns; the optional UQC code stored here is *consumed* later by the GST Engine (#31)

---

# Features

Implement

- Create Unit
- Edit Unit (all fields — see Business Rules)
- View Units (list)
- Activate Unit
- Deactivate Unit

Do not implement delete. Matching every other master in this codebase, Units are never
permanently deleted.

---

# Data Model

Add to `prisma/schema.prisma` (plus `units Unit[]` on `Company`):

```text
model Unit {
  id            String   @id @default(uuid())
  companyId     String
  company       Company  @relation(fields: [companyId], references: [id])
  name          String
  symbol        String
  uqcCode       String?
  decimalPlaces Int      @default(0)
  description   String?
  isActive      Boolean  @default(true)
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt

  @@unique([companyId, name])
  @@unique([companyId, symbol])
  @@index([companyId])
}
```

- `name` — display name, e.g. "Pieces", "Kilograms".
- `symbol` — the short form printed on documents and shown in quantity columns, e.g. "PCS",
  "KG". Unique per company, independently of `name`, so two units can never print identically.
- `uqcCode` — optional GST **Unit Quantity Code** (e.g. "PCS", "KGS", "MTR"), the code GSTR-1's
  HSN summary requires per line. Stored as a plain optional uppercase string now; the GST
  Engine (#31) formalizes/validates against the official UQC list later. A plain text field is
  deliberately the least-invented option — no hardcoded UQC catalog is introduced here.
- `decimalPlaces` — quantity precision (0–4), e.g. 0 for Pieces, 3 for Kilograms. Product
  Management and the Inventory Engine will use this to round/validate quantities.

**No `isSystemDefined` and no seeding — deliberate.** Unlike the chart of accounts (which
reports structurally depend on), no report or engine depends on any particular unit existing;
businesses use wildly different unit sets, so seeding a default list would just create noise.
Every unit is user-created. Consequently there is also no "system-defined units cannot be
renamed/deactivated" rule anywhere in this module.

---

# Business Rules

- `name` and `symbol` are each unique within their company (DB-enforced, two composite unique
  constraints). Surface each conflict with a field-specific friendly message.
- **All fields remain editable** (name, symbol, UQC code, decimal places, description). A Unit
  has no dependents until Product Management exists, and nothing financial references it —
  there is no immutability requirement here, unlike Ledger Groups' parent/nature.
  **Forward-compatible rule to record now**: once Product Management (#23) exists, reducing
  `decimalPlaces` on a unit already referenced by products must be re-examined (existing stock
  quantities could carry more precision than the new setting allows). Nothing to check against
  yet — no product table exists.
- **Company-scoped for every user.** Derive the active company server-side from the requesting
  user's own session (`getCurrentCompanyUser()`); never accept a company id from the client.
  Treat "belongs to a different company" identically to "not found."
- Deactivation has no invariant to guard (no children, no dependents yet) — a plain scoped
  update, mirroring `ledger-repository.ts`'s `deactivate()` (no Serializable/retry needed).

---

# Service / Repository

Create

```text
src/modules/units/repositories/unit-repository.ts
src/modules/units/services/unit-service.ts
src/modules/units/validation/unit-schema.ts
src/modules/units/actions/unit-actions.ts
src/modules/units/components/…
src/types/unit.ts
```

- `unitService`: `listUnits(filters)`, `getUnit(id)`, `createUnit(input)`, `updateUnit(id,
  input)`, `activateUnit(id)`, `deactivateUnit(id)`, and `listSelectableUnits()` (active only —
  the lookup Product Management will consume).
- Repository mirrors `ledger-repository.ts`: `findMany(companyId, filters)` with
  status/search filters, scoped `update`/`activate`/`deactivate` running their
  read-check-write inside `runInTransaction`.

**Shared Server Action runner**: the try/revalidate/catch envelope currently living in
`src/modules/ledgers/actions/run-ledger-action.ts` is generic, and importing it from the units
module would couple units → ledgers across module boundaries. Promote it to
`src/lib/run-action.ts` (`runAction`), refactor the three ledger-family action files onto it,
and move its test alongside. Behavior-identical; this is exactly the kind of extraction
`run-ledger-action.ts`'s own doc comment anticipated.

---

# Validation

Zod (`unit-schema.ts`):

- Name — required, trimmed, 2–100 characters
- Symbol — required, trimmed, 1–10 characters
- UQC code — optional; empty string normalizes to undefined; otherwise trimmed, uppercased,
  2–10 letters (A–Z only)
- Decimal places — required integer, 0–4
- Description — optional, max 500 characters

Create and Update accept the same field set (everything is editable).

---

# UI

Pages (under the existing **Masters** hub, not Accounting)

- `/masters/units` — Unit list (Name, Symbol, UQC, Decimal Places, Status, Actions)
- `/masters/units/new` — Create Unit
- `/masters/units/[id]/edit` — Edit Unit

Components (`src/modules/units/components/`): Unit Table, Unit Form, Unit Edit Form, Unit
Status Badge (per-module badge, matching the ledger/ledger-group convention).

Wire-up

- Add a "Units" card to the `/masters` hub page (`src/app/masters/page.tsx`), matching the
  existing card convention (lucide `Ruler` icon).
- Add `units: "Units"` to `src/constants/breadcrumbs.ts`.
- The Sidebar's Masters entry already links to `/masters` — no sidebar change.

**Known pre-existing inconsistency, out of scope**: the `/masters` hub page itself still gates
on the coarse `isCurrentUserCompanyAdmin()` redirect (it predates the permission catalog), so a
non-admin holding `masters:view` (Sales/Purchase/Store Manager roles) won't see the hub, but can
open `/masters/units` directly, which gates correctly on permissions. Reworking the hub's gate
touches Company/Financial-Year card visibility and is not part of this feature.

---

# Security

Every action gates via `assertPermission(user, "masters", …)` — `view` for list/detail reads,
`create`/`edit` for writes, and (matching `ledger-service.ts`'s documented convention, since the
catalog has no dedicated activate/deactivate action) `delete` for Activate/Deactivate. The
`"masters"` module and all actions already exist in the Permission catalog — no catalog changes.

All reads/writes scoped to the requesting user's own company (see Business Rules).

---

# Database

New model: `Unit`. New migration. No seeding, no bootstrap/domain-event changes, no changes to
any existing table beyond `Company.units`.

---

# Code Standards

Strict TypeScript, no `any`, Repository → Service → Server Action → UI, no business logic in
components, Zod validation at the boundary, Pino logging via the shared error helpers.

---

# Do Not

Do not implement

- Category / Brand / HSN / GST Rate / Warehouse / Product Management (#18–#23)
- Compound units, conversion factors, or quantity arithmetic
- A UQC master table or hardcoded UQC catalog (GST Engine #31 owns that decision)
- Default-unit seeding or any bootstrap/domain-event handler
- Delete endpoints

---

# Success Criteria

Verify

- Units can be created/edited/listed/activated/deactivated, scoped to the active company only.
- Duplicate name and duplicate symbol each produce a field-specific friendly error.
- UQC code accepts blank, normalizes to uppercase, and rejects non-letter input.
- Decimal places accepts 0–4 only.
- A unit belonging to another company resolves as "not found" for every operation.
- No delete is possible anywhere.
- `/masters` hub shows the Units card; breadcrumbs label `/masters/units` as "Units".
- `npx tsc --noEmit`, `npx eslint src prisma`, `npx vitest run`, and `next build` all pass.
