# 32 - Inventory Engine

> Feature-spec file number 32 (spec-file numbers are sequential and never reused). This
> feature is `context/Phases/phase-tracker.md`'s Phase 2 — Core Business Foundation →
> **Shared ERP Engines** item **#30 Inventory Engine**. Depends on Products (spec 25)
> and Warehouses (spec 24), both implemented. Independent of the Voucher and GST
> engines — it can land before or after them (the Document Number Engine, spec 34, is
> not a dependency either: stock rows are not numbered documents).

## Goal

Implement the **Inventory Engine** for **Premgiri Books ERP** — the sole owner of stock
movement (`architecture-context.md` Invariant 7: "Inventory movements are managed only
by the Inventory Engine"; code-standards.md Inventory Rules: "Stock quantity must never
be updated directly. Current stock is calculated from stock transactions").

The engine is a **service, not a screen** (the spec-30/31 engine convention): it exposes
the stock-transaction schema, movement-recording APIs, and stock/valuation queries that
future features consume — Opening Stock (#44), Stock Adjustment (#45), Stock Transfer
(#46), Physical Verification (#47), Sales Invoice (#36), GRN (#41), Purchase Invoice
(#42), and Inventory Reports (#67). **No transactional UI ships in this task** — nothing
exists yet that moves stock.

There is **no stock-quantity column anywhere**: current stock is always an aggregation
over stock transactions, exactly as ledger balances are aggregations over voucher
entries (spec 31's structural twin on the inventory side).

---

# Project Context

Before implementation, review

- PRD.md (§13 Inventory System), architecture-context.md (Core Engines → Inventory
  Engine, Costing Strategy — Latest Purchase Cost, Invariants 5, 7),
  code-standards.md (Inventory Rules — including "Negative stock depends on company
  settings"), ai-workflow-rules.md, progress-tracker.md
- `context/Phases/phase-tracker.md` (Shared ERP Engines; the Phase 5 Inventory features
  #44–#49 and Phase 3/4 documents that consume this engine)
- `25-product-management.md` (`Product.productType` — only `TRADING` products carry
  stock; unit `decimalPlaces` quantity precision; `minStockLevel`)
- `24-warehouse-management.md` (`Warehouse`, the required location dimension)
- `30-pricing-engine.md` / `31-voucher-engine.md` (the standing engine conventions:
  `src/engines/` placement, no permission checks inside engines, explicit `companyId`
  from authorized callers, optional `tx` pass-through, repository-owned Prisma access)

---

# Module Responsibilities

The Inventory Engine is responsible for

- The `StockTransaction` schema — the single place stock movement exists
- Recording movements: single entries, document-line batches, and atomic transfers
- Availability validation (the negative-stock gate, honoring the company setting)
- Stock queries: current stock (by product/warehouse), stock ledger, and valuation at
  Latest Purchase Cost (the data primitives Reports #67 and the Dashboard's low-stock
  alerts will render)

The Inventory Engine is **not** responsible for

- Any UI (Opening Stock #44, Adjustment #45, Transfer #46, Physical Verification #47
  are the screens; Inventory Reports #67 renders queries)
- Accounting effects of stock (stock-value vouchers are the consuming documents' job via
  the Voucher Engine — "Inventory module never creates accounting entries directly")
- Deciding *why* stock moves (documents pass finished movement lines, exactly as they
  pass finished entry lines to the Voucher Engine)
- Batch (#48) / serial (#49) tracking — schema deliberately excludes them now
- Reorder alerts (`Product.minStockLevel` comparison is a Dashboard/Reports read over
  this engine's `getCurrentStock`)

---

# Data Model

Add to `prisma/schema.prisma` (plus back-relations `stockTransactions
StockTransaction[]` on `Company`, `Product`, `Warehouse`; plus one new column on
`CompanySettings`):

```text
enum StockTransactionType {
  OPENING_STOCK
  PURCHASE
  PURCHASE_RETURN
  SALES
  SALES_RETURN
  TRANSFER
  ADJUSTMENT
  PHYSICAL_VERIFICATION
}

enum StockDirection {
  IN
  OUT
}

model StockTransaction {
  id              String               @id @default(uuid())
  companyId       String
  company         Company              @relation(fields: [companyId], references: [id])
  productId       String
  product         Product              @relation(fields: [productId], references: [id])
  warehouseId     String
  warehouse       Warehouse            @relation(fields: [warehouseId], references: [id])
  transactionType StockTransactionType
  direction       StockDirection
  quantity        Decimal              @db.Decimal(14, 4)
  unitCost        Decimal?             @db.Decimal(14, 2)
  transactionDate DateTime             @db.Date
  referenceType   String?
  referenceId     String?
  transferGroupId String?
  narration       String?
  createdAt       DateTime             @default(now())
  updatedAt       DateTime             @updatedAt

  @@index([companyId, productId, warehouseId])
  @@index([companyId, transactionDate])
  @@index([referenceType, referenceId])
  @@index([transferGroupId])
}

// added to model CompanySettings:
//   allowNegativeStock Boolean @default(false)
```

Decisions

- **`direction` + always-positive `quantity`** rather than signed quantities — explicit
  over clever; current stock = Σ IN − Σ OUT. Every quantity must honor the product
  unit's `decimalPlaces` (the spec-25 rule, enforced here for every movement).
- `warehouseId` **required** — every movement happens somewhere. Single-location
  companies use their one (default) warehouse; consuming screens will default it from
  `Product.defaultWarehouseId` / the company's default warehouse. A company with zero
  warehouses cannot move stock — a correct constraint, surfaced with a friendly error.
- `unitCost` — optional 2-decimal snapshot of the movement's per-unit cost (set by
  purchases/opening stock; null where meaningless, e.g. transfers). **Not used for
  valuation today**: the current costing strategy is Latest Purchase Cost
  (`architecture-context.md`), i.e. `Product.purchasePrice` × quantity — but FIFO /
  Weighted Average are documented future methods and are impossible to compute
  retroactively without per-movement cost history. Cheap to store now, expensive to
  wish for later.
- `transferGroupId` — a shared uuid linking a transfer's OUT and IN rows (one logical
  transfer = exactly two rows written atomically). No separate transfer-header table
  until Stock Transfer (#46) needs one for its document lifecycle.
- **No `financialYearId`** — deliberate: stock is continuous across financial years
  (closing stock of one year *is* opening stock of the next, with no re-entry); date
  filtering covers reporting. Vouchers are FY-scoped; stock is not. Recorded so nobody
  "fixes" the asymmetry with spec 31.
- `referenceType`/`referenceId` — polymorphic source-document link, no FK, same
  reasoning as spec 31. Manual adjustments leave them null until #45 gives them a
  document.
- `CompanySettings.allowNegativeStock` — the company setting code-standards.md's
  "Negative stock depends on company settings" requires; default `false`. Exposed on
  the existing Company Settings form (Profile page's Company Settings tab) as one new
  switch — the only UI in this task.
- **Immutability**: like voucher entries, stock transactions are never edited or
  deleted; corrections are opposite-direction `ADJUSTMENT` movements recorded by future
  screens. The engine exposes no update/delete API.

---

# Business Rules

- Only `TRADING` products may have stock transactions — `SERVICE`/`EXPENSE` products are
  rejected (`25-product-management.md`'s type semantics; the forward-noted "unitId /
  productType become immutable once movements exist" rule from spec 25 now becomes
  enforceable — **implement that check in the product module as part of this task**:
  `product-repository.ts`'s update path rejects `unitId`/`productType` changes when the
  product has any stock transaction, exactly as spec 25 anticipated).
- Product and warehouse must belong to the caller's company and be **active at movement
  time** (assignment-time rule; historical rows survive later deactivation untouched).
- **Every movement's `transactionType` constrains its `direction`** (validated wherever
  movements are accepted): `OPENING_STOCK` → IN only; `PURCHASE` → IN only;
  `PURCHASE_RETURN` → OUT only; `SALES` → OUT only; `SALES_RETURN` → IN only;
  `TRANSFER` → IN or OUT, but only as a `transferGroupId` pair written via
  `transferStock` (a lone TRANSFER row is rejected); `ADJUSTMENT` and
  `PHYSICAL_VERIFICATION` → IN or OUT freely. Invalid combinations (e.g. PURCHASE +
  OUT, SALES + IN) are rejected with a friendly error.
- **OUT movements validate availability**: current stock (product + warehouse) −
  outgoing quantity ≥ 0, unless `allowNegativeStock` is true. This check and the insert
  run inside **one Serializable transaction with bounded P2034 retry** (the
  `SERIALIZABLE_RETRY` recipe from financial-year/warehouse) — two concurrent sales
  must not both pass a read-then-write availability check. IN-only batches need no
  Serializable isolation.
- **Batch availability is validated on aggregated demand**: before checking, OUT
  quantities are summed per (product, warehouse) across the whole batch, and each
  pair's *total* is validated against current stock — three lines of 4 units each must
  not individually pass against a stock of 10. IN lines in the same batch are *not*
  netted against OUT lines (conservative by design — a batch must not depend on its own
  inflows to cover its outflows).
- `transferStock` writes the OUT row (source warehouse) and IN row (destination) with
  one `transferGroupId` in the same transaction; source ≠ destination; availability
  validated on the OUT side; `unitCost` null on both.
- `recordMovements(lines, tx?)` — the batch API documents use (one document = many
  lines, atomically, on the caller's transaction — the spec-31 `tx` pass-through
  convention, so invoice + voucher + stock post as one transaction). **Isolation
  contract for the passed `tx`**: the engine cannot upgrade the isolation level of, or
  retry, a transaction it does not own. When the batch contains any OUT or TRANSFER
  line, the caller must have opened the outer transaction at **Serializable** isolation
  and must own the bounded P2034 retry of the *entire* posting transaction (the shared
  `runInTransaction` + `SERIALIZABLE_RETRY` helpers exist for exactly this; the engine
  documents the requirement on the API and asserts it where the client exposes the
  isolation level). Only when no `tx` is supplied does the engine open and retry its
  own Serializable transaction, as the OUT rule above describes.
- Quantity > 0 always; decimals limited to the product unit's `decimalPlaces`
  (checked in-transaction against the loaded product+unit, the spec-25
  `minStockLevel` precedent).
- `transactionDate` must not be in the future (stock that hasn't happened yet doesn't
  exist); no FY validation (see Data Model).
- **Company-scoped** through the caller-supplied `companyId` (engine convention);
  every loaded row re-verified.

---

# Structure

Create

```text
src/engines/inventory/inventory-engine.ts     // recordMovement, recordMovements, transferStock
src/engines/inventory/inventory-queries.ts    // getCurrentStock, getStockLedger, getStockValuation
src/engines/inventory/inventory-validation.ts // pure checks: type/direction/quantity/date — unit-tested
src/engines/inventory/types.ts
src/modules/stock-transactions/repositories/stock-transaction-repository.ts
```

- Repository owns all Prisma access; Decimal → number normalization at its boundary.
- `getCurrentStock(companyId, {productId?, warehouseId?})` — grouped Σ IN − Σ OUT via
  Prisma `groupBy`; single-pair and per-warehouse breakdown shapes.
- `getStockLedger(companyId, productId, {warehouseId?, from?, to?})` — dated movements
  with running balance (the stock-register primitive for #67).
- `getStockValuation(companyId, {warehouseId?})` — per-product quantity × the
  product's current `purchasePrice` (Latest Purchase Cost — `architecture-context.md`
  Costing Strategy; products with null `purchasePrice` value at 0 and are flagged in
  the result so reports can surface them).
- Company Settings change rides the existing company-settings module (schema column,
  Zod boolean, one switch on the existing form — gated by that form's existing
  `company`/`edit` permission).
- No Server Actions for the engine itself, no permission checks inside it (convention),
  no pages/cards/breadcrumbs beyond the settings switch.

---

# Validation

Zod at the engine boundary: uuids, enums, positive quantity with dynamic decimal bound,
2-decimal optional unitCost, ISO date not in future, narration ≤ 500, reference fields
optional. Batch input: non-empty array.

---

# Security

No permission checks inside the engine — consumers gate (the `inventory` module actions
for items #44–#47, `sales`/`purchase` for documents). The one user-facing surface (the
`allowNegativeStock` switch) rides the company-settings form's existing gate. All
reads/writes company-scoped via caller-supplied `companyId`.

---

# Database

New model `StockTransaction`, new enums `StockTransactionType`, `StockDirection`; new
column `CompanySettings.allowNegativeStock`. One migration. Back-relations on `Company`,
`Product`, `Warehouse`. No seeding.

---

# Code Standards

Strict TypeScript, no `any`, pure validation core, Serializable + bounded-retry for
availability-checked writes, transactions for every write, vitest as a primary
deliverable:

- IN/OUT aggregation math incl. decimal quantities and per-warehouse grouping
- type/direction matrix (every allowed combination accepted; representative invalid
  combinations — PURCHASE + OUT, SALES + IN, OPENING_STOCK + OUT, a lone TRANSFER
  line — rejected)
- availability matrix (sufficient, exact-zero, insufficient with setting off → rejected,
  insufficient with setting on → allowed and negative stock reported), incl. the batch
  aggregation case (multiple OUT lines of one product/warehouse whose sum exceeds stock
  while each line alone would pass)
- non-TRADING product rejected; inactive/cross-company product/warehouse rejected
- unit `decimalPlaces` bound honored per product
- transfer atomicity, source ≠ destination, transferGroupId pairing
- product `unitId`/`productType` immutability once movements exist
- future-dated movements rejected; running-balance and valuation correctness

---

# Do Not

Do not implement

- Any inventory screen (#44–#47) or report page (#67); no dashboards or alerts
- Accounting entries or Voucher Engine calls (documents orchestrate both engines)
- Batch (#48) / serial-number (#49) tracking or schema reserved for them
- FIFO / Weighted Average valuation (Latest Purchase Cost only; `unitCost` is stored
  data, not a valuation method)
- A stored stock-quantity column, cache, or materialized view anywhere
- Editing/deleting stock transactions (no API may exist)
- A transfer-header document (Stock Transfer #46 owns its lifecycle)
- Barcode behavior of any kind

---

# Success Criteria

Verify

- Movements record atomically with every documented rejection case rejecting friendly
  (`AppError`): non-TRADING product, inactive/cross-company references, bad decimals,
  future date, zero/negative quantity.
- Concurrent OUT movements cannot oversell: with `allowNegativeStock` off, parallel
  drains of the same stock serialize correctly (Serializable + retry exercised in a
  test); with it on, stock goes negative and reads back negative.
- `transferStock` writes exactly two linked rows atomically and never moves stock a
  source warehouse doesn't have (setting off).
- A product with movements can no longer change `unitId`/`productType`; one without
  still can.
- Current stock, stock ledger running balance, and Latest-Purchase-Cost valuation are
  correct against a seeded fixture.
- The `allowNegativeStock` switch round-trips on the Company Settings form.
- `npx tsc --noEmit`, `npx eslint src prisma`, `npx vitest run`, and `next build` all
  pass.

Feature-spec 32 (this spec) is `context/Phases/phase-tracker.md`'s Phase 2 **Shared ERP
Engines** item #30.
