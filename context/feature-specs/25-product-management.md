# 25 - Product Management

> Feature-spec file number 25 (spec-file numbers are sequential and never reused). This
> feature is `context/Phases/phase-tracker.md`'s Phase 2 — Core Business Foundation →
> **Inventory Masters** item **#23 Product Management** — the capstone of the group.
> **Implement only after specs 19–24 (Units, Categories, Brands, HSN, GST Rates,
> Warehouses) are all complete** — this master references every one of them.

## Goal

Implement **Product Management** for **Premgiri Books ERP** — the product/item master that
every stock-bearing and billing feature (Sales, Purchase, Inventory Engine, Pricing Engine,
Opening Stock, Barcode Billing) will reference.

Per `context/Phases/phase-tracker.md`, Product Management depends on Categories + Brands +
Units + GST + HSN + Warehouse. Per `architecture-context.md`'s Product Architecture, the
supported product types are **Trading Product**, **Service**, and **Expense Item** (Formula
Product is reserved for a future release and is *not* added now).

This is a master-data feature only: **no stock, no pricing calculation, no documents**. The
master stores reference prices as plain data; every derived price is the Pricing Engine's
(#28) job and every quantity movement is the Inventory Engine's (#30) job
(`architecture-context.md` Invariants 6–7).

Do **not** implement Margin Profiles, Price Lists, the Pricing Engine, Opening Stock, batch
or serial tracking, or product images (see Do Not).

---

# Project Context

Before implementation, review

- PRD.md, project-overview.md, architecture-context.md (Product Architecture, Costing
  Strategy, Engine Driven principle), code-standards.md, ui-context.md,
  ai-workflow-rules.md, progress-tracker.md
- `context/Phases/phase-tracker.md` (this feature's place in Phase 2 → Inventory Masters,
  and the Pricing group #26–#28 that builds on it)
- `19-unit-management.md` through `24-warehouse-management.md` (the six masters this
  feature consumes; each exposes a `listSelectable…()` active-only lookup built for this
  form)
- `14-ledger-master.md` (the largest existing master form — the multi-lookup form pattern
  this task's Product Form scales up from)

---

# Module Responsibilities

The Products module is responsible for

- Product Master (Create/Edit/View/Activate/Deactivate, scoped to the active company)
- Classification links: Category, Brand, Unit, HSN/SAC code, GST Rate, default Warehouse
- Reference prices stored as plain data (MRP, selling price, purchase price) and a reorder
  threshold (`minStockLevel`) future features read
- A reusable lookup future Sales/Purchase/Inventory features read from (active products
  only)

The Products module is **not** responsible for

- Stock quantities, movements, or valuation (Inventory Engine #30, Opening Stock #44)
- Price *calculation*, margins, discounts, customer/dealer pricing (Pricing Engine #28,
  Margin Profiles #26, Price Lists #27)
- GST *calculation* (GST Engine #31 — this master only stores which rate/code applies)
- Batch or serial tracking (#48/#49), barcode *billing* (#76)
- Product images (Local File Storage exists, but image upload/management is deferred — see
  Do Not)

---

# Features

Implement

- Create Product
- Edit Product (all fields — with one forward-compatible caveat on Unit; see Business Rules)
- View Products (list with search + filters: type, category, brand, status)
- Activate Product
- Deactivate Product

Do not implement delete. Matching every other master in this codebase, Products are never
permanently deleted.

---

# Data Model

Add to `prisma/schema.prisma` (plus `products Product[]` on `Company`, and `products
Product[]` back-relations on `Category`, `Brand`, `Unit`, `HsnCode`, `GstRate`,
`Warehouse`):

```text
enum ProductType {
  TRADING
  SERVICE
  EXPENSE
}

model Product {
  id                 String      @id @default(uuid())
  companyId          String
  company            Company     @relation(fields: [companyId], references: [id])
  name               String
  productCode        String
  barcode            String?
  productType        ProductType @default(TRADING)
  categoryId         String?
  category           Category?   @relation(fields: [categoryId], references: [id])
  brandId            String?
  brand              Brand?      @relation(fields: [brandId], references: [id])
  unitId             String
  unit               Unit        @relation(fields: [unitId], references: [id])
  hsnCodeId          String?
  hsnCode            HsnCode?    @relation(fields: [hsnCodeId], references: [id])
  gstRateId          String?
  gstRate            GstRate?    @relation(fields: [gstRateId], references: [id])
  defaultWarehouseId String?
  defaultWarehouse   Warehouse?  @relation(fields: [defaultWarehouseId], references: [id])
  mrp                Decimal?    @db.Decimal(14, 2)
  sellingPrice       Decimal?    @db.Decimal(14, 2)
  purchasePrice      Decimal?    @db.Decimal(14, 2)
  minStockLevel      Decimal?    @db.Decimal(14, 4)
  description        String?
  isActive           Boolean     @default(true)
  createdAt          DateTime    @default(now())
  updatedAt          DateTime    @updatedAt

  @@unique([companyId, name])
  @@unique([companyId, productCode])
  @@unique([companyId, barcode])
  @@index([companyId])
  @@index([categoryId])
  @@index([brandId])
  @@index([unitId])
}
```

Field decisions

- `productCode` — required user-entered SKU, unique per company. No auto-numbering: the
  Document Number Engine (#32) doesn't exist yet, and inventing a one-off generator here
  would be superseded by it.
- `barcode` — optional (EAN/UPC or self-printed), unique per company when present (Postgres
  composite unique treats NULLs as distinct, so many products may omit it). Stored now so
  Barcode Billing (#76) has data to build on; no scanning/printing in this task.
- `productType` — `TRADING` / `SERVICE` / `EXPENSE` per the Product Architecture. `FORMULA`
  is deliberately **not** added to the enum now (reserved for the future manufacturing
  release; adding an enum value later is a trivial migration — YAGNI).
- `unitId` — **required for every type**, including services (billed in Hours/Nos/Jobs —
  the user creates the unit first). One mandatory rule beats a per-type conditional nothing
  needs yet.
- `categoryId`, `brandId`, `hsnCodeId`, `gstRateId`, `defaultWarehouseId` — all optional.
  Not every business classifies every product, exempt/unregistered scenarios exist, and
  single-location shops may never create a warehouse.
- `mrp` / `sellingPrice` / `purchasePrice` — optional reference prices, plain data.
  `purchasePrice` is the manually-entered starting value for `architecture-context.md`'s
  "Latest Purchase Cost" costing strategy; the Purchase module (#42) will later overwrite it
  on each purchase. No price *derivation* happens in this module.
- `minStockLevel` — optional reorder threshold, `Decimal(14,4)` because quantities honor the
  unit's `decimalPlaces` (0–4).

**No `isSystemDefined` and no seeding — deliberate**, same reasoning as every Inventory
Master since Units.

---

# Business Rules

- `name`, `productCode`, and `barcode` (when present) are each unique within their company
  (DB-enforced). Surface each conflict with a field-specific friendly message.
- **Every referenced master must belong to the same company and be active at assignment
  time** (server-verified inside the write transaction — never trust client ids). "At
  assignment time" is load-bearing: on **update**, the company-scope + active checks apply
  only to references that are *newly assigned or changed* relative to the stored row. A
  reference the update leaves unchanged is preserved as-is — even if that master has been
  deactivated since it was assigned — otherwise an unrelated edit (fixing a typo in the
  product name) would be blocked by a since-deactivated brand, contradicting the next
  sentence. Changed or newly assigned ids are always fully re-verified (active +
  same-company), so an inactive or cross-company master can never be *introduced* via
  update. A master deactivated *after* assignment does not invalidate existing products; it
  only disappears from the pickers for new assignments (each master's `listSelectable…()`
  rule).
- `hsnCodeId`, when set, should match the product type: goods (`TRADING`/`EXPENSE`) pick
  `HSN`-type codes, `SERVICE` picks `SAC`-type codes. Enforce as a validation error at the
  service boundary (the HSN lookup is already filterable by `codeType` per
  `22-hsn-management.md`).
- `minStockLevel`, when set, must not carry more decimal places than the selected unit's
  `decimalPlaces` (the first consumer of that Unit field, exactly as
  `19-unit-management.md` anticipated).
- **All fields remain editable, including `unitId`** — no stock exists yet, so changing a
  unit is safe. Forward-compatible rule to record now: once the Inventory Engine (#30)
  records movements for a product, `unitId` must become immutable (changing it would
  silently re-denominate historical quantities). Same posture for `productType`. Nothing to
  check against yet.
- Deactivation has no invariant to guard today — a plain scoped update. Deactivated
  products keep all references; future documents simply cannot select them.
- **Company-scoped for every user.** Derive the active company server-side from the
  requesting user's own session (`getCurrentCompanyUser()`); never accept a company id from
  the client. Treat "belongs to a different company" identically to "not found."

---

# Service / Repository

Create

```text
src/modules/products/repositories/product-repository.ts
src/modules/products/services/product-service.ts
src/modules/products/validation/product-schema.ts
src/modules/products/actions/product-actions.ts
src/modules/products/components/…
src/types/product.ts
```

- `productService`: `listProducts(filters)` (status/search/type/category/brand filters,
  including related names for the table), `getProduct(id)` (with related master names for
  the detail/edit view), `createProduct(input)`, `updateProduct(id, input)`,
  `activateProduct(id)`, `deactivateProduct(id)`, and `listSelectableProducts()` (active
  only — the lookup Sales/Purchase/Inventory will consume).
- Create verifies **all** supplied master references (company scope + active) inside
  `runInTransaction`, then writes. Update first reads the stored row (company-scoped, in the
  same transaction), diffs each reference field against it, and re-verifies **only the
  changed or newly assigned** ids — unchanged references pass through untouched, even if
  that master has since been deactivated (see Business Rules). Same read-check-write shape
  as every prior master, just over more references.
- Server Actions use the shared `runAction` envelope (`src/lib/run-action.ts`).

---

# Validation

Zod (`product-schema.ts`):

- Name — required, trimmed, 2–200 characters
- Product Code — required, trimmed, 2–50 characters
- Barcode — optional; empty string normalizes to undefined; otherwise trimmed, 4–50
  characters
- Product Type — required enum: `TRADING` / `SERVICE` / `EXPENSE`
- Category / Brand / HSN Code / GST Rate / Default Warehouse — optional uuids (server
  re-verifies scope, active status, and the HSN-vs-SAC type match — on update, scope/active
  re-verification applies to changed or newly assigned ids only; see Business Rules)
- Unit — required uuid (server re-verifies)
- MRP / Selling Price / Purchase Price — optional numbers, ≥ 0, max 2 decimal places
- Min Stock Level — optional number, ≥ 0, decimals limited to the selected unit's
  `decimalPlaces` (service-level check, since it depends on the unit)
- Description — optional, max 1000 characters

Create and Update accept the same field set.

---

# UI

Pages (under the existing **Masters** hub)

- `/masters/products` — Product list (Name, Code, Type, Category, Brand, Unit, Selling
  Price, Status, Actions) with search and type/category/brand/status filters
- `/masters/products/new` — Create Product
- `/masters/products/[id]/edit` — Edit Product

Components (`src/modules/products/components/`): Product Table (with filter bar), Product
Form, Product Edit Form, Product Status Badge, Product Type Badge. The form groups fields
into sections (Identity, Classification, Tax, Pricing, Stock) — it is the largest master
form so far; keep each section a focused sub-component per the file-size standards. Lookup
comboboxes consume the sibling modules' `listSelectable…()` services; the HSN picker filters
by `codeType` based on the chosen Product Type.

Wire-up

- Add a "Products" card to the `/masters` hub page (`src/app/masters/page.tsx`), matching
  the existing card convention (lucide `Package` icon).
- Add `products: "Products"` to `src/constants/breadcrumbs.ts`.
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

New model: `Product`, new enum `ProductType`. New migration. Adds `products` back-relations
to `Company`, `Category`, `Brand`, `Unit`, `HsnCode`, `GstRate`, `Warehouse` — no other
change to existing tables. No seeding, no bootstrap/domain-event changes.

---

# Code Standards

Strict TypeScript, no `any`, Repository → Service → Server Action → UI, no business logic in
components (no price or tax math anywhere in the UI — Engine Driven), Zod validation at the
boundary, Pino logging via the shared error helpers.

---

# Do Not

Do not implement

- Margin Profiles / Price Lists / Pricing Engine (#26–#28) or any price calculation
- Opening Stock (#44), stock quantities, stock ledger, or any Inventory Engine behavior
- GST calculation of any kind (GST Engine #31)
- Batch (#48) / Serial Number (#49) tracking, or fields reserved for them
- Barcode generation, printing, or scanning (#76 — only the stored `barcode` string)
- Product images or file uploads
- A `FORMULA` product type (reserved for the future manufacturing release)
- Per-warehouse product settings or product-warehouse mapping tables (the single optional
  `defaultWarehouseId` is all this phase needs)
- Auto-generated product codes (Document Number Engine #32 owns numbering)
- Delete endpoints

---

# Success Criteria

Verify

- Products of all three types can be created/edited/listed/activated/deactivated, scoped to
  the active company only.
- Duplicate name, product code, and barcode each produce a field-specific friendly error;
  multiple products with no barcode coexist.
- Every lookup only offers active, same-company masters; a reference from another company is
  rejected server-side even if injected past the UI.
- A `SERVICE` product cannot save an `HSN`-type code, and goods cannot save a `SAC`-type
  code.
- `minStockLevel` respects the selected unit's `decimalPlaces`.
- Deactivating a referenced master (e.g. a brand) leaves existing products intact and only
  removes it from pickers; editing such a product *without changing* that reference still
  saves, while changing any reference to an inactive or cross-company master is rejected.
- No delete is possible anywhere.
- `/masters` hub shows the Products card; breadcrumbs label `/masters/products` as
  "Products".
- `npx tsc --noEmit`, `npx eslint src prisma`, `npx vitest run`, and `next build` all pass.

Completing this spec completes `context/Phases/phase-tracker.md`'s Phase 2 **Inventory
Masters** group; Phase 2 overall remains In Progress (Business Parties, Pricing, and Shared
ERP Engines groups follow).
