# 29 - Price Lists

> Feature-spec file number 29 (spec-file numbers are sequential and never reused). This
> feature is `context/Phases/phase-tracker.md`'s Phase 2 — Core Business Foundation →
> **Pricing** item **#27 Price Lists**. Depends on Margin Profiles (feature-spec 28) —
> not for schema, but because the Pricing Engine's documented resolution order
> (price list beats margin profile) only makes sense once both exist. **Implement after
> feature-spec 28.**

## Goal

Implement **Price Lists** for **Premgiri Books ERP** — named collections of fixed
per-product selling prices (`PRD.md` §587: "Price List — Collection of selling prices")
that the Pricing Engine (tracker #28) will consult **before** falling back to margin
calculation.

A Price List is pure master data: a header (name, optional customer tier, optional
validity window) plus item rows (product → price, with an optional minimum-quantity
break). The validity window is what makes **promotional pricing** expressible as data;
the quantity break is what makes **quantity pricing** expressible as data (`PRD.md` §12
lists both) — *selecting* the right row at billing time is exclusively the Pricing
Engine's job. **No price resolution logic is built in this task.**

---

# Project Context

Before implementation, review

- PRD.md (§12), project-overview.md (Pricing Engine feature list),
  architecture-context.md (Engine Driven), code-standards.md (Pricing Rules),
  ui-context.md, ai-workflow-rules.md, progress-tracker.md
- `context/Phases/phase-tracker.md` (Phase 2 → Pricing; the Pricing Engine #28 that
  consumes this data)
- `28-margin-profiles.md` (the sibling pricing master and this group's conventions)
- `25-product-management.md` (the `Product` model item rows reference, and the
  reference-verification pattern)
- `09-financial-year.md` (the inclusive-date-boundary and overlap-wording precedent this
  spec's validity window reuses)

---

# Module Responsibilities

The Price Lists module is responsible for

- Price List header Master (Create/Edit/View/Activate/Deactivate, scoped to the active
  company)
- Price List Items (add/edit/remove product price rows within a list — the first master
  in this codebase with child rows edited under a parent)
- A reusable read API the Pricing Engine consumes (active lists with their items)

The Price Lists module is **not** responsible for

- Choosing which price applies to a sale (Pricing Engine, tracker #28 — including
  date-window and quantity-break selection and the customer→list assignment lookup)
- The `Customer.priceListId` assignment column (added by the Pricing Engine spec, which
  depends on Customers; this module ships no Customer changes)
- Margin Profiles (feature-spec 28), discounts, or any calculation

---

# Features

Implement

- Create Price List (header)
- Edit Price List (header + items on one screen)
- View Price Lists (list with search + status filter)
- Activate / Deactivate Price List
- Add / edit / remove item rows (product, price, optional minimum quantity)

Do not implement delete **of price lists**. Matching every other master, Price Lists are
never permanently deleted. **Item rows are the documented exception**: an item row is
removable (hard delete) — it is a detail line of an editable master, not a business
record with history; nothing references a `PriceListItem` (the Pricing Engine reads, it
never links), and Sales documents will snapshot the resolved price at posting time
rather than referencing the row (the HSN snapshot-at-posting precedent).

---

# Data Model

Add to `prisma/schema.prisma` (plus `priceLists PriceList[]` on `Company` and
`priceListItems PriceListItem[]` on `Product`):

```text
model PriceList {
  id            String        @id @default(uuid())
  companyId     String
  company       Company       @relation(fields: [companyId], references: [id])
  name          String
  customerType  CustomerType?
  effectiveFrom DateTime?     @db.Date
  effectiveTo   DateTime?     @db.Date
  description   String?
  isActive      Boolean       @default(true)
  createdAt     DateTime      @default(now())
  updatedAt     DateTime      @updatedAt

  items PriceListItem[]

  @@unique([companyId, name])
  @@index([companyId])
}

model PriceListItem {
  id           String    @id @default(uuid())
  priceListId  String
  priceList    PriceList @relation(fields: [priceListId], references: [id])
  productId    String
  product      Product   @relation(fields: [productId], references: [id])
  sellingPrice Decimal   @db.Decimal(14, 2)
  minQuantity  Decimal   @default(1) @db.Decimal(14, 4)
  createdAt    DateTime  @default(now())
  updatedAt    DateTime  @updatedAt

  @@unique([priceListId, productId, minQuantity])
  @@index([priceListId])
  @@index([productId])
}
```

Field decisions

- `customerType` — **optional** tier restriction reusing spec 26's `CustomerType` enum.
  `null` = the list is tier-agnostic (applies to any customer the Pricing Engine routes
  to it). A tiered list is how "wholesale price list" is expressed without a parallel
  mechanism.
- `effectiveFrom` / `effectiveTo` — optional inclusive calendar dates (`@db.Date`,
  compared by calendar day — the `09-financial-year.md` boundary convention). Both
  `null` = always effective; one-sided windows allowed. This is the *promotional
  pricing* primitive: a Diwali list is just a list with a window. **Overlapping windows
  across lists are legal** — the Pricing Engine's resolution order (documented in spec
  30) decides among simultaneously-effective lists; a DB-level overlap ban would forbid
  legitimate setups (a standing wholesale list + a short promo list).
- `minQuantity` — the *quantity pricing* primitive: `(priceListId, productId,
  minQuantity)` unique means one product may have several rows ("1+ → ₹100, 10+ → ₹95");
  the engine picks the highest break ≤ ordered quantity. Defaults to 1 (a plain price
  row). `Decimal(14,4)` matching quantity precision everywhere else.
- `sellingPrice` — required per row (`Decimal(14,2)`); a row with no price is
  meaningless. Plain data — no validation against cost here (below-cost *warnings* are a
  Pricing Engine/document-time concern, and a list may deliberately price below cost for
  a promotion).
- **`PriceListItem` carries no `companyId`** — deliberate departure from the
  denormalization convention: an item is reachable only through its parent list, every
  repository query joins through `priceListId`, and the parent's `companyId` is the
  single tenant anchor (the item is a detail line, not an independently-queried entity).
  Product references are still tenant-verified server-side on every write.

**No `isSystemDefined` and no seeding — deliberate.**

---

# Business Rules

- Header `name` unique per company; friendly field-specific conflict message.
- Every item's `productId` must belong to the same company and be **active at assignment
  time** (spec 25's rule verbatim, applied when a row is added or its product changed;
  existing rows for a since-deactivated product stay valid and visible, labeled
  inactive).
- `effectiveFrom ≤ effectiveTo` when both present (inclusive days).
- Item writes always run company-scoped through the parent: repository methods take the
  list id, re-verify the list belongs to the active company inside the transaction, then
  write the row (read-check-write, `runInTransaction`). No Serializable isolation — the
  `@@unique` on `(priceListId, productId, minQuantity)` is the only cross-row invariant
  and the DB enforces it; translate `P2002` to a friendly "this product already has a
  row at this quantity break" message.
- Deactivating a list has no dependent invariant (the engine simply skips inactive
  lists); items are retained untouched.
- **Company-scoped for every user** via `getCurrentCompanyUser()`; cross-company ids
  resolve as not-found — including item ids, which resolve through their parent.

---

# Service / Repository

Create

```text
src/modules/price-lists/repositories/price-list-repository.ts
src/modules/price-lists/services/price-list-service.ts
src/modules/price-lists/validation/price-list-schema.ts
src/modules/price-lists/actions/price-list-actions.ts
src/modules/price-lists/components/…
src/types/price-list.ts
```

- `priceListService`: `listPriceLists(filters)` (status/name-search; rows include an
  item count), `getPriceList(id)` (header + items with product name/code for the
  editor), `createPriceList(input)`, `updatePriceList(id, input)` (header fields),
  `activatePriceList(id)`, `deactivatePriceList(id)`, `addItem(listId, input)`,
  `updateItem(listId, itemId, input)`, `removeItem(listId, itemId)`, and
  `findEffectiveLists(criteria)` — the read API the Pricing Engine will consume (active
  lists, optionally filtered by customerType and an effective date; returns headers +
  matching items). Ship `findEffectiveLists` now with tests so spec 30 consumes a proven
  primitive.
- Decimal columns (`sellingPrice`, `minQuantity`) normalize to `number` at the
  repository boundary (the established convention).
- Server Actions use the shared `runAction` envelope.

---

# Validation

Zod (`price-list-schema.ts`):

- Name — required, trimmed, 2–100 characters
- Customer Type — optional enum (`RETAIL`/`WHOLESALE`/`DEALER`/`DISTRIBUTOR`), reusing
  spec 26's exported tuple
- Effective From / To — optional ISO dates; object-level refine: from ≤ to when both
  present
- Description — optional, max 500, blank→undefined

Item schema:

- Product — required uuid (server re-verifies scope + active)
- Selling Price — required number, ≥ 0, max 2 decimals (`hasAtMostTwoDecimals`)
- Min Quantity — optional number ≥ 0.0001 defaulting to 1, max 4 decimals

---

# UI

Pages (under the existing **Masters** hub)

- `/masters/price-lists` — list (Name, Tier — em-dash when tier-agnostic, Effective
  window, Items count, Status, Actions)
- `/masters/price-lists/new` — Create (header only; items are added on the edit screen
  after creation — keeps create simple and avoids a nested-form state machine)
- `/masters/price-lists/[id]/edit` — Edit header + the **items editor**: a table of
  rows (Product, Min Qty, Price — `font-financial` — row actions) with an add-row form
  using the product picker (`listSelectableProducts()`, with the "(Inactive)" merge-in
  for existing rows referencing since-deactivated products)

Components (`src/modules/price-lists/components/`): Price List Table, Price List Form
(header), Price List Items Editor, Status Badge. The items editor is this codebase's
first parent-child editor — keep item mutations as individual Server Actions (add /
update / remove per row, each with the per-row pending `ReadonlySet` pattern) rather
than a whole-list batch save; it matches the action envelope convention and avoids
diffing logic.

Wire-up

- "Price Lists" card on the `/masters` hub (lucide `ListOrdered`).
- `"price-lists": "Price Lists"` in `src/constants/breadcrumbs.ts`. No sidebar change.

---

# Security

Every action gates via `assertPermission(user, "masters", …)` — `view` for reads,
`create`/`edit` for writes (item add/update/remove gate on `edit` — they are edits *of
the list*), `delete` for Activate/Deactivate. No Permission catalog changes.

All reads/writes scoped to the requesting user's own company; item access always
resolves through the parent list's company check.

---

# Database

New models `PriceList` and `PriceListItem`. One migration. Back-relations on `Company`
and `Product`. No Customer changes (spec 30 owns `Customer.priceListId`). No seeding.

---

# Code Standards

Strict TypeScript, no `any`, Repository → Service → Server Action → UI, no price
resolution or comparison logic anywhere (Engine Driven), Zod at the boundary, vitest
coverage for both schemas and for `findEffectiveLists`' date/tier filtering.

---

# Do Not

Do not implement

- Price *resolution* of any kind — which list wins, quantity-break selection,
  date-window selection at billing time (Pricing Engine, feature-spec 30)
- `Customer.priceListId` or any customer-side assignment (feature-spec 30)
- Discount rules or percentage-off lists (fixed prices only; discounts are a future
  Pricing Engine capability)
- Bulk import of items (Excel Import is tracker #73)
- Copy/duplicate-list convenience actions (add when a user asks)
- Overlap prevention across lists (legal by design — see Data Model)
- Delete endpoints for price lists (item-row removal is the documented exception)

---

# Success Criteria

Verify

- Lists can be created/edited/listed/activated/deactivated, scoped to the active
  company; duplicate header names get a friendly error.
- Items can be added/edited/removed on the edit screen; the same product can carry
  multiple quantity-break rows; a duplicate `(product, minQuantity)` row gets a friendly
  error; prices/quantities respect decimal bounds.
- A cross-company or inactive product cannot be introduced into a list server-side;
  existing rows survive product deactivation and render labeled.
- `findEffectiveLists` returns exactly the active lists matching a given date and tier
  in its vitest coverage.
- Effective-window validation enforces from ≤ to; overlapping windows across lists are
  accepted.
- No delete of a list is possible; item-row removal works.
- `/masters` hub shows the card; breadcrumbs resolve.
- `npx tsc --noEmit`, `npx eslint src prisma`, `npx vitest run`, and `next build` all
  pass.

Feature-spec 29 (this spec) is `context/Phases/phase-tracker.md`'s Phase 2 **Pricing**
item #27. The Pricing Engine (feature-spec 30, tracker #28) consumes it next.
