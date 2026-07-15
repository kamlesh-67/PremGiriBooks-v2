# 23 - GST Rate Management

> Feature-spec file number 23 (spec-file numbers are sequential and never reused). This
> feature is `context/Phases/phase-tracker.md`'s Phase 2 — Core Business Foundation →
> **Inventory Masters** item **#21 GST Rate Management**.

## Goal

Implement **GST Rate Management** for **Premgiri Books ERP** — the master list of GST rate
slabs (0%, 5%, 12%, 18%, 28%, …) that Product Management (tracker #23) will assign to
products and that the GST Engine (tracker #31) will later read to compute CGST/SGST/IGST and
cess on documents.

Per `context/Phases/phase-tracker.md`, GST Rate Management depends only on Database
Foundation. It mirrors the flat company-scoped-master pattern of `19-unit-management.md`.

This master stores **only the total rate and cess**. How a rate splits into CGST+SGST
(intra-state) versus IGST (inter-state) is pure calculation — CGST = SGST = half the rate,
IGST = the full rate — and per `architecture-context.md`'s Engine Driven principle that
arithmetic belongs exclusively to the GST Engine (#31). Storing the split would duplicate
derivable data.

Do **not** implement Category, Brand, HSN, Warehouse, or Product Management in this task
(specs 20–22, 24–25), and do not implement any GST calculation.

---

# Project Context

Before implementation, review

- PRD.md, project-overview.md, architecture-context.md, code-standards.md, ui-context.md,
  ai-workflow-rules.md, progress-tracker.md
- `context/Phases/phase-tracker.md` (this feature's place in Phase 2 → Inventory Masters)
- `19-unit-management.md` (the template this task mirrors: Repository → Service → Server
  Action → UI, `assertPermission()`, company-scoped reads/writes, Activate/Deactivate
  instead of delete, shared `runAction` envelope in `src/lib/run-action.ts`)
- `22-hsn-management.md` (the sibling GST-adjacent master; note the two are deliberately
  independent — see Module Responsibilities)

---

# Module Responsibilities

The GST Rates module is responsible for

- GST Rate Master (Create/Edit/View/Activate/Deactivate, scoped to the active company)
- A reusable lookup future Product Management reads from (active rates only)

The GST Rates module is **not** responsible for

- GST calculation of any kind — CGST/SGST/IGST splits, cess amounts, inclusive/exclusive
  arithmetic (GST Engine, tracker #31)
- HSN codes or any HSN→rate mapping (HSN Management is spec 22; the two masters stay
  independent and Product Management references each separately, matching the tracker's
  dependency arrows — a per-HSN default rate is a GST Engine decision, deferred)
- GST registers or returns (Phase 7)

---

# Features

Implement

- Create GST Rate
- Edit GST Rate (all fields)
- View GST Rates (list)
- Activate GST Rate
- Deactivate GST Rate

Do not implement delete. Matching every other master in this codebase, GST Rates are never
permanently deleted.

---

# Data Model

Add to `prisma/schema.prisma` (plus `gstRates GstRate[]` on `Company`):

```text
model GstRate {
  id          String   @id @default(uuid())
  companyId   String
  company     Company  @relation(fields: [companyId], references: [id])
  name        String
  ratePercent Decimal  @db.Decimal(5, 2)
  cessPercent Decimal  @default(0) @db.Decimal(5, 2)
  description String?
  isActive    Boolean  @default(true)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  @@unique([companyId, name])
  @@index([companyId])
}
```

- `name` — display label, e.g. "GST 18%", "GST 28% + 12% Cess", "Exempt". Unique per
  company. The name, not the numbers, is what pickers and documents display.
- `ratePercent` — the **total** GST rate (0–100, two decimals — the statutory 0.25% slab
  needs them). `Decimal(5,2)` matches the codebase's Decimal-for-money/percentage
  convention (`Ledger.openingBalance`).
- `cessPercent` — compensation cess percentage, default 0. Stored now so the slab is
  complete; only the GST Engine will ever compute with it. Quantity-based (₹/unit) cess is
  out of scope until an actual requirement appears (YAGNI).

**No `isSystemDefined` and no seeding — deliberate.** Statutory slabs are well-known, but
(matching the reasoning recorded for Units in `19-unit-management.md`) no report or engine
depends structurally on any particular rate row existing, slabs change by government
notification, and seeding would require a `TenantBootstrapService`/`bootstrapVersion` bump
plus a backfill story for existing companies — cost without a structural need. Every rate is
user-created; the Create form is a 30-second task per slab.

---

# Business Rules

- `name` unique within the company (DB-enforced). Surface the conflict with a friendly
  field-specific message. Duplicate *percentages* under different names are allowed —
  legitimate (e.g. "GST 12% Goods" vs "GST 12% Services" if a business wants separate
  labels), and blocking them would add a constraint nothing needs.
- **All fields remain editable** while nothing references a rate. Forward-compatible rule to
  record now: once transactional documents exist, posted document lines must snapshot the
  percentage at posting time (Voucher/GST Engine concern), so editing this master never
  silently changes historical tax amounts. Until then, editing `ratePercent` on a rate that
  products reference (once Product Management exists) is allowed and simply flows into
  future documents — that is the *point* of a rate master when a notification changes a
  slab.
- Deactivation has no invariant to guard — a plain scoped update. Products referencing a
  deactivated rate keep their reference; selectable lookups list active rates only.
- **Company-scoped for every user.** Derive the active company server-side from the
  requesting user's own session (`getCurrentCompanyUser()`); never accept a company id from
  the client. Treat "belongs to a different company" identically to "not found."

---

# Service / Repository

Create

```text
src/modules/gst-rates/repositories/gst-rate-repository.ts
src/modules/gst-rates/services/gst-rate-service.ts
src/modules/gst-rates/validation/gst-rate-schema.ts
src/modules/gst-rates/actions/gst-rate-actions.ts
src/modules/gst-rates/components/…
src/types/gst-rate.ts
```

- `gstRateService`: `listGstRates(filters)`, `getGstRate(id)`, `createGstRate(input)`,
  `updateGstRate(id, input)`, `activateGstRate(id)`, `deactivateGstRate(id)`, and
  `listSelectableGstRates()` (active only — the lookup Product Management will consume).
- Repository mirrors `unit-repository.ts`: `findMany(companyId, filters)` with
  status/search filters, scoped `update`/`activate`/`deactivate` running their
  read-check-write inside `runInTransaction`.
- Server Actions use the shared `runAction` envelope (`src/lib/run-action.ts`).

---

# Validation

Zod (`gst-rate-schema.ts`):

- Name — required, trimmed, 2–100 characters
- Rate Percent — required number, 0–100 inclusive, max 2 decimal places
- Cess Percent — optional number (defaults to 0), 0–100 inclusive, max 2 decimal places
- Description — optional, max 500 characters

Create and Update accept the same field set. Decimal fields cross the Server Action boundary
as strings/numbers and are converted at the service edge, matching how
`Ledger.openingBalance` is already handled.

---

# UI

Pages (under the existing **Masters** hub)

- `/masters/gst-rates` — GST Rate list (Name, Rate %, Cess %, Status, Actions)
- `/masters/gst-rates/new` — Create GST Rate
- `/masters/gst-rates/[id]/edit` — Edit GST Rate

Components (`src/modules/gst-rates/components/`): GST Rate Table, GST Rate Form, GST Rate
Edit Form, GST Rate Status Badge.

Wire-up

- Add a "GST Rates" card to the `/masters` hub page (`src/app/masters/page.tsx`), matching
  the existing card convention (lucide `Percent` icon).
- Add `"gst-rates": "GST Rates"` to `src/constants/breadcrumbs.ts`.
- The Sidebar's Masters entry already links to `/masters` — no sidebar change.

The `/masters` hub page's coarse `isCurrentUserCompanyAdmin()` gate remains a known
pre-existing inconsistency, out of scope (recorded in `19-unit-management.md`).

---

# Security

Every action gates via `assertPermission(user, "masters", …)` — `view` for list/detail
reads, `create`/`edit` for writes, and `delete` for Activate/Deactivate (the documented
convention since `ledger-service.ts`). No Permission catalog changes.

All reads/writes scoped to the requesting user's own company (see Business Rules).

---

# Database

New model: `GstRate`. New migration. No seeding, no bootstrap/domain-event changes, no
changes to any existing table beyond `Company.gstRates`.

---

# Code Standards

Strict TypeScript, no `any`, Repository → Service → Server Action → UI, no business logic in
components, Zod validation at the boundary, Pino logging via the shared error helpers.

---

# Do Not

Do not implement

- Category / Brand / HSN / Warehouse / Product Management (specs 20–22, 24–25)
- Any GST arithmetic: CGST/SGST/IGST splits, cess amounts, inclusive/exclusive price math
  (GST Engine #31 owns all of it)
- Stored CGST/SGST/IGST component columns (derivable — see Goal)
- Quantity-based (₹/unit) cess
- HSN→rate mapping or a default rate per HSN
- Slab seeding or any bootstrap/domain-event handler
- Delete endpoints

---

# Success Criteria

Verify

- GST Rates can be created/edited/listed/activated/deactivated, scoped to the active company
  only.
- Rate and cess accept 0–100 with up to 2 decimals (0.25 works); out-of-range and
  3-decimal input is rejected.
- Duplicate name produces a field-specific friendly error; duplicate percentages under
  different names are allowed.
- A rate belonging to another company resolves as "not found" for every operation.
- No delete is possible anywhere.
- `/masters` hub shows the GST Rates card; breadcrumbs label `/masters/gst-rates` as
  "GST Rates".
- `npx tsc --noEmit`, `npx eslint src prisma`, `npx vitest run`, and `next build` all pass.
