# 20 - Category Management

> Feature-spec file number 20 (spec-file numbers are sequential and never reused — 18 is
> `18-super-admin-company-lifecycle.md`, 19 is `19-unit-management.md`). This feature is
> `context/Phases/phase-tracker.md`'s Phase 2 — Core Business Foundation → **Inventory
> Masters** item **#18 Category Management**. Tracker numbers and spec-file numbers diverge
> from here on; each spec records its own mapping.

## Goal

Implement **Category Management** for **Premgiri Books ERP** — the product classification
tree (the "Stock Group" concept Tally-class users already know) that Product Management
(tracker #23) will assign every product to, and that future inventory/sales reports will
group by.

Per `context/Phases/phase-tracker.md`, Category Management depends only on Database
Foundation. It mirrors the company-scoped-master pattern established by Ledger Groups →
Units, with one structural addition: an optional parent/child hierarchy.

Do **not** implement Brand, HSN, GST Rate, Warehouse, or Product Management in this task
(specs 21–25).

---

# Project Context

Before implementation, review

- PRD.md, project-overview.md, architecture-context.md, code-standards.md, ui-context.md,
  ai-workflow-rules.md, progress-tracker.md
- `context/Phases/phase-tracker.md` (this feature's place in Phase 2 → Inventory Masters)
- `19-unit-management.md` (the immediate predecessor this task mirrors: Repository → Service
  → Server Action → UI, `assertPermission()`, company-scoped reads/writes,
  Activate/Deactivate instead of delete, shared `runAction` envelope in
  `src/lib/run-action.ts`)
- `13-ledger-groups.md` (the existing hierarchy precedent — and where this spec deliberately
  diverges from it; see Business Rules)

---

# Module Responsibilities

The Categories module is responsible for

- Category Master (Create/Edit/View/Activate/Deactivate, scoped to the active company),
  with an optional parent/child hierarchy
- A reusable lookup future Product Management reads from (active categories only)

The Categories module is **not** responsible for

- Products or product-to-category assignment (Product Management, tracker #23)
- Category-wise stock or sales reporting (Phase 5/9)
- Brands, HSN codes, GST rates, Warehouses (specs 21–24)

---

# Features

Implement

- Create Category (optionally under a parent category)
- Edit Category (all fields including parent — see Business Rules)
- View Categories (list, rendered as an expandable tree by parent/child, mirroring the
  Ledger Group Tree)
- Activate Category
- Deactivate Category

Do not implement delete. Matching every other master in this codebase, Categories are never
permanently deleted.

---

# Data Model

Add to `prisma/schema.prisma` (plus `categories Category[]` on `Company`):

```text
model Category {
  id               String     @id @default(uuid())
  companyId        String
  company          Company    @relation(fields: [companyId], references: [id])
  name             String
  parentCategoryId String?
  parentCategory   Category?  @relation("CategoryHierarchy", fields: [parentCategoryId], references: [id])
  childCategories  Category[] @relation("CategoryHierarchy")
  description      String?
  isActive         Boolean    @default(true)
  createdAt        DateTime   @default(now())
  updatedAt        DateTime   @updatedAt

  @@unique([companyId, name])
  @@index([companyId])
  @@index([parentCategoryId])
}
```

- `name` is unique per company across the whole tree (not merely among siblings) — matching
  `LedgerGroup`'s rule, and required anyway for an unambiguous flat lookup in the Product
  form.

**No `isSystemDefined` and no seeding — deliberate**, for the same reason as Units
(`19-unit-management.md`): no report or engine depends structurally on any particular
category existing, and businesses use wildly different category trees. Every category is
user-created.

---

# Business Rules

- `name` unique within the company (DB-enforced). Surface the conflict with a friendly
  field-specific message.
- **The parent is editable — a deliberate divergence from Ledger Groups.** Ledger Groups
  froze `parentGroupId` because a sub-group inherits its parent's accounting *nature*, and
  re-parenting would silently reclassify financial structure. A Category carries no
  inherited classification — re-parenting it changes only presentation/grouping — so Edit
  may change `parentCategoryId` (plus `name`/`description`). This buys back the
  cycle-prevention obligation Ledger Groups designed away:
  **the service must reject setting a category's parent to itself or to any of its own
  descendants** (walk the descendant set inside the same transaction as the update, mirroring
  the read-check-write pattern of `ledger-repository.ts`).
- The parent, when supplied, must belong to the same company and be **active** at assignment
  time. A parent later deactivated does not cascade to children (see next rule for the
  reverse direction).
- **A category cannot be deactivated while it has any active child category** — the same
  invariant, transactionally checked, as Ledger Groups. Forward-compatible rule to record
  now: once Product Management (tracker #23) exists, deactivation should also warn/block
  while active products reference the category. Nothing to check against yet — no product
  table exists.
- **Company-scoped for every user.** Derive the active company server-side from the
  requesting user's own session (`getCurrentCompanyUser()`); never accept a company id from
  the client. Treat "belongs to a different company" identically to "not found."

---

# Service / Repository

Create

```text
src/modules/categories/repositories/category-repository.ts
src/modules/categories/services/category-service.ts
src/modules/categories/validation/category-schema.ts
src/modules/categories/actions/category-actions.ts
src/modules/categories/components/…
src/types/category.ts
```

- `categoryService`: `listCategories(filters)` (flat, with status/search filters),
  `getCategoryTree()` (parent → children for the tree UI), `getCategory(id)`,
  `createCategory(input)`, `updateCategory(id, input)`, `activateCategory(id)`,
  `deactivateCategory(id)`, and `listSelectableCategories()` (active only — the lookup
  Product Management will consume).
- Repository mirrors `unit-repository.ts`; the update path (which may re-parent) and
  deactivate path run their read-check-write inside `runInTransaction` (cycle check and
  active-child check respectively).
- Server Actions use the shared `runAction` envelope (`src/lib/run-action.ts`).

---

# Validation

Zod (`category-schema.ts`):

- Name — required, trimmed, 2–100 characters
- Parent Category — optional uuid; server re-verifies company scope, active status, and the
  no-cycle rule (never trust the client)
- Description — optional, max 500 characters

Create and Update accept the same field set.

---

# UI

Pages (under the existing **Masters** hub)

- `/masters/categories` — Category tree/list (Name, Parent, Status, Actions), expandable by
  parent/child mirroring the Ledger Group Tree
- `/masters/categories/new` — Create Category
- `/masters/categories/[id]/edit` — Edit Category

Components (`src/modules/categories/components/`): Category Tree, Category Form (with a
parent-picker combobox that excludes the category being edited and its descendants),
Category Edit Form, Category Status Badge.

Wire-up

- Add a "Categories" card to the `/masters` hub page (`src/app/masters/page.tsx`), matching
  the existing card convention (lucide `FolderTree` icon).
- Add `categories: "Categories"` to `src/constants/breadcrumbs.ts`.
- The Sidebar's Masters entry already links to `/masters` — no sidebar change.

The `/masters` hub page's coarse `isCurrentUserCompanyAdmin()` gate remains a known
pre-existing inconsistency, out of scope (recorded in `19-unit-management.md`).

---

# Security

Every action gates via `assertPermission(user, "masters", …)` — `view` for list/detail
reads, `create`/`edit` for writes, and `delete` for Activate/Deactivate (the documented
convention since `ledger-service.ts`; the catalog has no dedicated activate/deactivate
action). No Permission catalog changes.

All reads/writes scoped to the requesting user's own company (see Business Rules).

---

# Database

New model: `Category`. New migration. No seeding, no bootstrap/domain-event changes, no
changes to any existing table beyond `Company.categories`.

---

# Code Standards

Strict TypeScript, no `any`, Repository → Service → Server Action → UI, no business logic in
components, Zod validation at the boundary, Pino logging via the shared error helpers.

---

# Do Not

Do not implement

- Brand / HSN / GST Rate / Warehouse / Product Management (specs 21–25)
- Category-wise reports, stock grouping, or product counts per category
- Category images/icons
- `isSystemDefined` categories or any seeding
- Delete endpoints

---

# Success Criteria

Verify

- Categories can be created/edited/listed/activated/deactivated, scoped to the active
  company only, with an optional parent.
- Re-parenting works, and setting a category's parent to itself or any descendant is
  rejected with a friendly error.
- A category with an active child cannot be deactivated.
- Duplicate name produces a field-specific friendly error.
- A category belonging to another company resolves as "not found" for every operation.
- No delete is possible anywhere.
- `/masters` hub shows the Categories card; breadcrumbs label `/masters/categories` as
  "Categories".
- `npx tsc --noEmit`, `npx eslint src prisma`, `npx vitest run`, and `next build` all pass.
