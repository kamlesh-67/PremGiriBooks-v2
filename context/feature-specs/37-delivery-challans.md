# 37 - Delivery Challans

> Feature-spec file number 37. This feature is `context/Phases/phases.md`'s **Phase 3 —
> Sales Management** and `context/Phases/phase-tracker.md`'s Phase 3 item **#35 Delivery
> Challans**. Depends on Sales Orders (feature-spec 36). Third of the seven Phase 3
> documents. **Read the header note under Business Rules carefully — this is the one
> document in the chain that, per the tracker's own `Depends On` column, does not depend
> on the Inventory Engine, a deliberate scope decision this spec makes explicit rather
> than silently deciding on its own.**

## Goal

Implement **Delivery Challans** for **Premgiri Books ERP** — the dispatch/goods-movement
record between a confirmed Sales Order (feature-spec 36) and the eventual Sales Invoice
(feature-spec 38). A Delivery Challan documents *what physically left the warehouse and
when*, and feeds `SalesOrder.applyDelivery` for fulfillment tracking.

**Scope decision, stated up front**: `context/Phases/phase-tracker.md`'s Phase 3 table
lists Delivery Challans' `Depends On` as `Sales Orders` only — not `Inventory Engine`,
unlike Sales Invoice's row which explicitly lists `Voucher + Inventory + GST Engines`.
This spec honors that literally: **a Delivery Challan does not call the Inventory Engine
and does not decrement stock.** Stock is only ever moved by Sales Invoice's own posting
(spec 38), which is the sole `StockTransactionType.SALES` writer in this phase. A
Delivery Challan is a paper/dispatch record — real-world businesses that need goods to
leave the warehouse (by document) before the invoice is raised will see stock levels
still reflect pre-dispatch quantity until that later invoice posts. This is a known,
deliberate simplification (matching the tracker's own scoping), not an omission — recorded
here and cross-referenced from `32-inventory-engine.md` via `progress-tracker.md` once
implemented, exactly as this project records every scope simplification rather than
silently overreaching.

---

# Project Context

Before implementation, review

- `36-sales-orders.md` (**read this first** — `applyDelivery`, `listOpenForCustomer`,
  the header/line/engine-reuse conventions this spec extends)
- `context/Phases/phase-tracker.md` (Phase 3 table — confirm the `Depends On` column
  reading above before writing any Inventory Engine call into this feature)
- `32-inventory-engine.md` (read to confirm `recordMovements`/`StockTransactionType` is
  **not** called here — the boundary this spec deliberately does not cross)
- `26-customer-management.md`, `24-warehouse-management.md` (`Warehouse` — the dispatch
  source recorded per line, for record-keeping/reporting only in this task)
- `34-document-number-engine.md` (`DocumentType.DELIVERY_CHALLAN`)

---

# Module Responsibilities

The Delivery Challans module is responsible for

- Delivery Challan Master (Create/Edit/View/Dispatch/Cancel, scoped to the active company
  and financial year)
- Recording, per line, the **warehouse** goods are recorded as dispatched from (display/
  reporting metadata only in this task — see Goal) and the **dispatched quantity** (which
  may be less than the Sales Order line's remaining quantity — partial delivery)
- Calling `SalesOrder.applyDelivery` when a challan is dispatched (updates
  `deliveredQuantity` and the order's own status)
- Delivery Challan numbering via the Document Number Engine
  (`DocumentType.DELIVERY_CHALLAN`)
- A reusable "dispatched, not yet invoiced" lookup Sales Invoice (spec 38) reads from

The Delivery Challans module is **not** responsible for

- Any stock movement (see Goal's scope decision) or GST/Voucher posting — a Delivery
  Challan has zero financial and zero inventory effect in this phase
- Sales Orders or Sales Invoices themselves (specs 36, 38)
- Consolidated challans spanning more than one Sales Order (see Data Model)

---

# Data Model

Add to `prisma/schema.prisma` (plus `deliveryChallans DeliveryChallan[]` back-relations on
`Company`, `FinancialYear`, `Customer`, `Warehouse`, `User`):

```text
enum DeliveryChallanStatus {
  DRAFT
  DISPATCHED
  INVOICED
  CANCELLED
}

model DeliveryChallan {
  id              String                @id @default(uuid())
  companyId       String
  company         Company               @relation(fields: [companyId], references: [id])
  financialYearId String
  financialYear   FinancialYear         @relation(fields: [financialYearId], references: [id])
  challanNumber   String
  challanDate     DateTime              @db.Date
  customerId      String
  customer        Customer              @relation(fields: [customerId], references: [id])
  salesOrderId    String?
  salesOrder      SalesOrder?           @relation(fields: [salesOrderId], references: [id])
  status          DeliveryChallanStatus @default(DRAFT)
  narration       String?
  createdByUserId String?
  createdBy       User?                 @relation(fields: [createdByUserId], references: [id])
  createdAt       DateTime              @default(now())
  updatedAt       DateTime              @updatedAt

  items         DeliveryChallanItem[]
  salesInvoice  SalesInvoice?           // spec 38's back-relation target, 1:1

  @@unique([companyId, financialYearId, challanNumber])
  @@index([companyId, customerId])
  @@index([companyId, status])
  @@index([salesOrderId])
}

model DeliveryChallanItem {
  id                 String           @id @default(uuid())
  deliveryChallanId  String
  deliveryChallan    DeliveryChallan  @relation(fields: [deliveryChallanId], references: [id])
  lineNumber         Int
  productId          String
  product            Product          @relation(fields: [productId], references: [id])
  warehouseId        String
  warehouse          Warehouse        @relation(fields: [warehouseId], references: [id])
  quantity           Decimal          @db.Decimal(14, 4)
  salesOrderItemId   String?
  salesOrderItem     SalesOrderItem?  @relation(fields: [salesOrderItemId], references: [id])

  @@unique([deliveryChallanId, lineNumber])
  @@index([productId])
  @@index([warehouseId])
}
```

Decisions

- **No pricing or GST fields on this document** — a Delivery Challan records *quantity
  and source warehouse only*, not value. This follows directly from the scope decision in
  Goal: with no accounting or GST impact, storing a price/tax snapshot here would be dead
  data with no consumer (the eventual Sales Invoice resolves its own pricing/GST
  independently, per spec 38, exactly as Sales Order re-resolves rather than copies from
  Quotation).
- `salesOrderId` — optional at the header (a challan may be raised directly with no prior
  order — a common shortcut, mirroring Sales Order's own optional `quotationId`).
  **Linkage is conditional, not independently optional per line**: when `salesOrderId` is
  set, every line **must** carry a `salesOrderItemId` referencing an item of *that same*
  order (validated server-side; an item belonging to a different order is rejected); when
  `salesOrderId` is absent, no line may carry a `salesOrderItemId` (rejected if present —
  a line cannot reference an order item the header itself doesn't link to). **No
  consolidated challan spanning multiple Sales Orders** (Do Not).
- `warehouseId` per line, not per header — mirrors the Inventory Engine's own per-line
  granularity (spec 32) even though no stock call happens here, so the schema is already
  shaped correctly for the day a future spec decides to move the stock-out point here
  (a forward-compatible column, not a forward-noted migration, since it's needed for
  display/reporting regardless).
- `salesInvoice` back-relation is 1:1 — this phase's simplification is one Delivery
  Challan invoiced by at most one Sales Invoice (see `38-sales-invoice.md`'s Do Not on
  consolidated billing).

---

# Business Rules

- **Editable while `DRAFT`.** Dispatching (`DRAFT → DISPATCHED`) freezes the document —
  no update API accepts a `DISPATCHED`-or-later challan's id.
- **Dispatching a challan**, in one transaction:
  1. Validates every line's product/warehouse belong to the company and are active.
  2. If `salesOrderId` is set, calls `salesOrderService.applyDelivery(salesOrderId,
     lines, tx)` (spec 36) — passing this challan's own transaction client, so the
     delivered-quantity update and the status flip are atomic with this write.
  3. Sets `status = DISPATCHED`.
  4. **Does not call the Inventory Engine** (see Goal) — no `StockTransaction` row is
     written by this action.
- **Quantity rule**: when linked to a Sales Order, a line's `quantity` must not exceed
  that order line's remaining quantity (`salesOrderItem.quantity −
  salesOrderItem.deliveredQuantity`) at dispatch time — re-checked inside the dispatch
  transaction (not just at line-add time) to guard against two challans racing against
  the same order line. **Concurrency safety, made explicit** (a plain read-then-write
  check is not race-free under default isolation): the dispatch transaction runs
  **Serializable, with the same bounded-retry contract the Inventory Engine's OUT-batch
  posting uses** (spec 32's `SERIALIZABLE_RETRY` convention, also reused by Sales
  Invoice's posting, spec 38) — `applyDelivery`'s remaining-quantity check and its
  `deliveredQuantity` increment run inside that one Serializable transaction, so two
  concurrent dispatches against the same order line cannot both observe the same
  pre-update remaining quantity and both succeed; the loser's transaction aborts on
  conflict, retries up to the bounded limit, and re-observes the now-reduced remaining
  quantity on that retry — surfacing the friendly "insufficient remaining quantity on the
  linked order" error if it no longer fits, mirroring the Inventory Engine's own
  insufficient-stock rejection style.
- **Status transitions**: `DRAFT → DISPATCHED` (Dispatch), `DISPATCHED → INVOICED`
  (automatic, set when a Sales Invoice referencing this challan is posted — spec 38's
  responsibility to call back into this module, not a user action), `DRAFT →
  CANCELLED` (Cancel, only while `DRAFT` — a `DISPATCHED` challan represents goods that
  have physically left the building and cannot be silently un-dispatched; correcting a
  mistaken dispatch is a manual, out-of-system business process in this phase, not a
  cancel button).
- **Numbering**: `challanNumber` via the Document Number Engine
  (`DocumentType.DELIVERY_CHALLAN`), same two-step contract as every document in this
  phase.
- **Company-scoped for every user**, identical posture to specs 35–36.

---

# Service / Repository

Create

```text
src/modules/delivery-challans/repositories/delivery-challan-repository.ts
src/modules/delivery-challans/services/delivery-challan-service.ts
src/modules/delivery-challans/validation/delivery-challan-schema.ts
src/modules/delivery-challans/actions/delivery-challan-actions.ts
src/modules/delivery-challans/components/…
src/types/delivery-challan.ts
```

- `deliveryChallanService`: `listDeliveryChallans(filters)`, `getDeliveryChallan(id)`,
  `createDeliveryChallan(input)`, `createFromSalesOrder(salesOrderId, lines)` (pre-fills
  from the order's remaining quantities), `updateDeliveryChallan(id, input)` (only while
  `DRAFT`), `dispatchDeliveryChallan(id)`, `cancelDeliveryChallan(id)`,
  `listDispatchedNotInvoiced(customerId)` (the lookup Sales Invoice, spec 38, reads from),
  and `markInvoiced(deliveryChallanId, tx?)` — called exclusively by Sales Invoice's
  posting flow, accepting an optional transaction client (the established `tx?`
  convention).
- Repository → Service layering; Decimal → number normalization at the boundary.

---

# Validation

Zod (`delivery-challan-schema.ts`): `customerId` uuid, `salesOrderId` optional uuid,
`challanDate` calendar date, `narration` ≤ 500, lines array ≥ 1 with `productId`/
`warehouseId` uuid, `quantity` > 0 honoring the product unit's decimal precision.
`salesOrderItemId` is conditional, not a plain per-line optional field: an object-level
refine makes it **required** on every line when `salesOrderId` is present (server
re-verifies each referenced item belongs to that same `salesOrderId`, rejecting a
different order's item) and **forbidden** on every line when `salesOrderId` is absent.

---

# UI

Pages (under the `/sales` hub)

- `/sales/challans` — Delivery Challan list (Number, Customer, Date, Linked Order,
  Status, Actions) with search + status/customer filters
- `/sales/challans/new` — Create Delivery Challan (optionally pre-filled from a Sales
  Order's "Create Delivery Challan" action)
- `/sales/challans/[id]` — View Delivery Challan (read-only detail, status actions:
  Dispatch / Cancel — gated by status)
- `/sales/challans/[id]/edit` — Edit Delivery Challan (only reachable while `DRAFT`)

Components (`src/modules/delivery-challans/components/`): Delivery Challan Table (+
filter bar), Delivery Challan Form (product + warehouse + quantity line editor — no price/
tax columns, per the Data Model decision), Delivery Challan Status Badge.

Wire-up

- Add a "Delivery Challans" card to the `/sales` hub page.
- Add `challans: "Delivery Challans"` to `src/constants/breadcrumbs.ts`.

---

# Security

Gated by the `sales` permission module: `view`, `create`, `edit` (update while `DRAFT`,
Dispatch), `delete` not implemented (Cancel, `DRAFT`-only, is the removal path). Company-
scoped identically to specs 35–36.

---

# Database

New enum `DeliveryChallanStatus`; new models `DeliveryChallan`, `DeliveryChallanItem`.
One migration. Back-relations on `Company`, `FinancialYear`, `Customer`, `Product`,
`Warehouse`, `SalesOrder`, `SalesOrderItem`, `User`. No seeding.

---

# Code Standards

Same as specs 35–36: strict TypeScript, no `any`, transactions for dispatch (including
the cross-module `applyDelivery` call), vitest coverage for: the remaining-quantity race
guard (two dispatch attempts against the same order line), the status matrix,
`markInvoiced`'s idempotent no-op if called twice (defensive, since Sales Invoice cancel/
retry paths could otherwise double-call it), numbering uniqueness.

---

# Do Not

Do not implement

- **Any Inventory Engine call or stock movement** — the central scope decision of this
  spec (see Goal); do not "helpfully" wire this up even though it seems like the natural
  place — Sales Invoice (spec 38) is the sole stock-out point in this phase, per the
  tracker's own dependency list
- Any Voucher or GST posting
- Consolidated challans spanning multiple Sales Orders
- Un-dispatching / editing a `DISPATCHED` challan
- Printing, PDF generation, or WhatsApp sharing (deferred identically to specs 35–36)

---

# Success Criteria

Verify

- Dispatching a challan linked to a Sales Order correctly calls `applyDelivery`
  atomically (both writes succeed or both roll back together) and never writes a
  `StockTransaction` row (grep for any Inventory Engine import in this module — there
  should be none).
- The remaining-quantity race guard rejects a dispatch that would over-deliver an order
  line.
- `challanNumber` is unique per company/financial year via the Document Number Engine.
- `npx tsc --noEmit`, `npx eslint src prisma`, `npx vitest run`, and `next build` all pass;
  `/sales/challans*` appears in the build route table.

Feature-spec 37 (this spec) is `context/Phases/phase-tracker.md`'s Phase 3 item #35.
Feature-spec 38 (Sales Invoice, tracker #36) depends on it via `listDispatchedNotInvoiced`
and `markInvoiced`.
