# 21 - Brand Management

> Feature-spec file number 21 (spec-file numbers are sequential and never reused). This
> feature is `context/Phases/phase-tracker.md`'s Phase 2 — Core Business Foundation →
> **Inventory Masters** item **#19 Brand Management**.

## Goal

Implement **Brand Management** for **Premgiri Books ERP** — the master list of product
brands/manufacturers (publishers, in the book trade; paint manufacturers in the future
formula-management vertical) that Product Management (tracker #23) will reference and that
future inventory/sales reports will filter by.

Per `context/Phases/phase-tracker.md`, Brand Management depends only on Database Foundation.
It is the simplest Inventory Master — a flat, company-scoped name list — and mirrors
`19-unit-management.md` minus the unit-specific fields.

Do **not** implement Category, HSN, GST Rate, Warehouse, or Product Management in this task
(specs 20, 22–25).

---

# Project Context

Before implementation, review

- PRD.md, project-overview.md, architecture-context.md, code-standards.md, ui-context.md,
  ai-workflow-rules.md, progress-tracker.md
- `context/Phases/phase-tracker.md` (this feature's place in Phase 2 → Inventory Masters)
- `19-unit-management.md` (the template this task mirrors most directly: Repository →
  Service → Server Action → UI, `assertPermission()`, company-scoped reads/writes,
  Activate/Deactivate instead of delete, shared `runAction` envelope in
  `src/lib/run-action.ts`)

---

# Module Responsibilities

The Brands module is responsible for

- Brand Master (Create/Edit/View/Activate/Deactivate, scoped to the active company)
- A reusable lookup future Product Management reads from (active brands only)

The Brands module is **not** responsible for

- Products or product-to-brand assignment (Product Management, tracker #23)
- Brand-wise stock or sales reporting (Phase 5/9)
- Supplier/manufacturer contact records (Supplier Management, tracker #25, is a separate
  Business Parties feature — a Brand is a label on products, not a trading party)

---

# Features

Implement

- Create Brand
- Edit Brand (all fields)
- View Brands (list)
- Activate Brand
- Deactivate Brand

Do not implement delete. Matching every other master in this codebase, Brands are never
permanently deleted.

---

# Data Model

Add to `prisma/schema.prisma` (plus `brands Brand[]` on `Company`):

```text
model Brand {
  id          String   @id @default(uuid())
  companyId   String
  company     Company  @relation(fields: [companyId], references: [id])
  name        String
  description String?
  isActive    Boolean  @default(true)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  @@unique([companyId, name])
  @@index([companyId])
}
```

**No `isSystemDefined` and no seeding — deliberate**, for the same reason as Units
(`19-unit-management.md`): nothing depends structurally on any particular brand existing.
Every brand is user-created. No hierarchy either — unlike Categories, brands have no
grouping semantics anywhere in this ERP's plans (YAGNI).

---

# Business Rules

- `name` unique within the company (DB-enforced). Surface the conflict with a friendly
  field-specific message.
- **All fields remain editable.** A Brand has no dependents until Product Management exists
  and nothing financial references it — no immutability requirement.
- Deactivation has no invariant to guard (no children, no dependents yet) — a plain scoped
  update. Forward-compatible rule to record now: once Product Management (tracker #23)
  exists, active products referencing a deactivated brand keep their reference; only new
  assignment is prevented (selectable lookups list active brands only).
- **Company-scoped for every user.** Derive the active company server-side from the
  requesting user's own session (`getCurrentCompanyUser()`); never accept a company id from
  the client. Treat "belongs to a different company" identically to "not found."

---

# Service / Repository

Create

```text
src/modules/brands/repositories/brand-repository.ts
src/modules/brands/services/brand-service.ts
src/modules/brands/validation/brand-schema.ts
src/modules/brands/actions/brand-actions.ts
src/modules/brands/components/…
src/types/brand.ts
```

- `brandService`: `listBrands(filters)`, `getBrand(id)`, `createBrand(input)`,
  `updateBrand(id, input)`, `activateBrand(id)`, `deactivateBrand(id)`, and
  `listSelectableBrands()` (active only — the lookup Product Management will consume).
- Repository mirrors `unit-repository.ts`: `findMany(companyId, filters)` with
  status/search filters, scoped `update`/`activate`/`deactivate` running their
  read-check-write inside `runInTransaction`.
- Server Actions use the shared `runAction` envelope (`src/lib/run-action.ts`).

---

# Validation

Zod (`brand-schema.ts`):

- Name — required, trimmed, 2–100 characters
- Description — optional, max 500 characters

Create and Update accept the same field set.

---

# UI

Pages (under the existing **Masters** hub)

- `/masters/brands` — Brand list (Name, Description, Status, Actions)
- `/masters/brands/new` — Create Brand
- `/masters/brands/[id]/edit` — Edit Brand

Components (`src/modules/brands/components/`): Brand Table, Brand Form, Brand Edit Form,
Brand Status Badge (per-module badge, matching the established convention).

Wire-up

- Add a "Brands" card to the `/masters` hub page (`src/app/masters/page.tsx`), matching the
  existing card convention (lucide `Tag` icon).
- Add `brands: "Brands"` to `src/constants/breadcrumbs.ts`.
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

New model: `Brand`. New migration. No seeding, no bootstrap/domain-event changes, no changes
to any existing table beyond `Company.brands`.

---

# Code Standards

Strict TypeScript, no `any`, Repository → Service → Server Action → UI, no business logic in
components, Zod validation at the boundary, Pino logging via the shared error helpers.

---

# Do Not

Do not implement

- Category / HSN / GST Rate / Warehouse / Product Management (specs 20, 22–25)
- Brand logos/images
- Brand hierarchy or brand-to-supplier links
- `isSystemDefined` brands or any seeding
- Delete endpoints

---

# Success Criteria

Verify

- Brands can be created/edited/listed/activated/deactivated, scoped to the active company
  only.
- Duplicate name produces a field-specific friendly error.
- A brand belonging to another company resolves as "not found" for every operation.
- No delete is possible anywhere.
- `/masters` hub shows the Brands card; breadcrumbs label `/masters/brands` as "Brands".
- `npx tsc --noEmit`, `npx eslint src prisma`, `npx vitest run`, and `next build` all pass.
