# 43 - Goods Receipt Note

> Feature-spec file number 43. This feature is `context/Phases/phases.md`'s **Phase 4 —
> Purchase Management** and `context/Phases/phase-tracker.md`'s Phase 4 item **#41
> Goods Receipt Note**. Depends on Purchase Orders (feature-spec 42). Second of Phase 4's
> four documents — the mirror of `37-delivery-challans.md` from the purchase side; read
> that spec's Goal note carefully, since the same deliberate scope decision applies here.

## Goal

Implement **Goods Receipt Note (GRN)** for **Premgiri Books ERP** — the receiving/
goods-inward record between a confirmed Purchase Order (feature-spec 42) and the eventual
Purchase Invoice (feature-spec 44). A GRN documents *what physically arrived at the
warehouse and when*, and feeds `PurchaseOrder.applyReceipt` for fulfillment tracking.

**Scope decision, stated up front — identical in shape to `37-delivery-challans.md`'s**:
`context/Phases/phase-tracker.md`'s Phase 4 table lists Goods Receipt Note's `Depends On`
as `Purchase Order` only — not `Inventory Engine`, unlike Purchase Invoice's row which
explicitly lists `Voucher + Inventory + GST Engines`. This spec honors that literally:
**a Goods Receipt Note does not call the Inventory Engine and does not increment stock.**
Stock is only ever moved by Purchase Invoice's own posting (spec 44), which is the sole
`StockTransactionType.PURCHASE` writer in this phase. A GRN is a paper/receiving record —
goods can physically sit in the warehouse, received and shelved, while stock levels still
show pre-receipt quantity until the invoice (which may arrive days later, e.g. waiting on
the supplier's bill) posts. This mirrors Delivery Challan's identical simplification on
the sales side and is recorded with the same explicitness — a documented limitation, not
an oversight.

---

# Project Context

Before implementation, review

- `37-delivery-challans.md` (**read this first in full**, including its Goal note — this
  spec is its purchase-side mirror; the header/line/status shape and the "does not call
  the Inventory Engine" reasoning transfer directly)
- `42-purchase-orders.md` (`applyReceipt`, `listOpenForSupplier`, the conventions this
  spec extends)
- `context/Phases/phase-tracker.md` (Phase 4 table — confirm the `Depends On` column
  reading above before writing any Inventory Engine call into this feature)
- `32-inventory-engine.md` (read to confirm `recordMovements`/`StockTransactionType` is
  **not** called here)
- `24-warehouse-management.md` (`Warehouse` — the receiving location recorded per line,
  display/reporting metadata only in this task)
- `34-document-number-engine.md` (`DocumentType.GOODS_RECEIPT_NOTE`)

---

# Module Responsibilities

The Goods Receipt Note module is responsible for

- GRN Master (Create/Edit/View/Receive/Cancel, scoped to the active company and
  financial year)
- Recording, per line, the **warehouse** goods are recorded as received into (display/
  reporting metadata only) and the **received quantity** (which may be less than the
  Purchase Order line's remaining quantity — partial receipt), plus an optional
  **rejected/damaged quantity** note (see Data Model)
- Calling `PurchaseOrder.applyReceipt` when a GRN is marked received
- GRN numbering via the Document Number Engine (`DocumentType.GOODS_RECEIPT_NOTE`)
- A reusable "received, not yet invoiced" lookup Purchase Invoice (spec 44) reads from

The Goods Receipt Note module is **not** responsible for

- Any stock movement (see Goal's scope decision) or GST/Voucher posting
- Purchase Orders or Purchase Invoices themselves (specs 42, 44)
- Consolidated GRNs spanning more than one Purchase Order

---

# Data Model

Add to `prisma/schema.prisma` (plus `goodsReceiptNotes GoodsReceiptNote[]` back-relations
on `Company`, `FinancialYear`, `Supplier`, `Warehouse`, `User`):

```text
enum GoodsReceiptNoteStatus {
  DRAFT
  RECEIVED
  INVOICED
  CANCELLED
}

model GoodsReceiptNote {
  id              String                 @id @default(uuid())
  companyId       String
  company         Company                @relation(fields: [companyId], references: [id])
  financialYearId String
  financialYear   FinancialYear          @relation(fields: [financialYearId], references: [id])
  grnNumber       String
  grnDate         DateTime               @db.Date
  supplierId      String
  supplier        Supplier               @relation(fields: [supplierId], references: [id])
  purchaseOrderId String?
  purchaseOrder   PurchaseOrder?         @relation(fields: [purchaseOrderId], references: [id])
  status          GoodsReceiptNoteStatus @default(DRAFT)
  narration       String?
  createdByUserId String?
  createdBy       User?                  @relation(fields: [createdByUserId], references: [id])
  createdAt       DateTime               @default(now())
  updatedAt       DateTime               @updatedAt

  items           GoodsReceiptNoteItem[]
  purchaseInvoice PurchaseInvoice?       // spec 44's back-relation target, 1:1

  @@unique([companyId, financialYearId, grnNumber])
  @@index([companyId, supplierId])
  @@index([companyId, status])
  @@index([purchaseOrderId])
}

model GoodsReceiptNoteItem {
  id                  String            @id @default(uuid())
  goodsReceiptNoteId  String
  goodsReceiptNote    GoodsReceiptNote  @relation(fields: [goodsReceiptNoteId], references: [id])
  lineNumber          Int
  productId           String
  product             Product           @relation(fields: [productId], references: [id])
  warehouseId         String
  warehouse           Warehouse         @relation(fields: [warehouseId], references: [id])
  quantity            Decimal           @db.Decimal(14, 4)
  rejectedQuantity    Decimal           @db.Decimal(14, 4) @default(0)
  purchaseOrderItemId String?
  purchaseOrderItem   PurchaseOrderItem? @relation(fields: [purchaseOrderItemId], references: [id])

  @@unique([goodsReceiptNoteId, lineNumber])
  @@index([productId])
  @@index([warehouseId])
}
```

Decisions

- **No pricing or GST fields** — same reasoning as `37-delivery-challans.md`: with no
  accounting/GST impact, storing a price snapshot here is dead data. Purchase Invoice
  (spec 44) resolves its own cost independently.
- **`rejectedQuantity`** — one field this spec adds beyond Delivery Challan's shape: a
  purchase receipt commonly finds damaged/short/incorrect goods, which the receiving
  business reports back to the supplier without them ever entering usable stock. Since
  no stock movement happens here anyway (see Goal), `rejectedQuantity` is **pure
  record-keeping** in this task — it does not feed `applyReceipt` differently (both
  `quantity` and `rejectedQuantity` count toward "received" for order-fulfillment
  purposes, since the goods did physically arrive; only Purchase Invoice's own line
  quantity, entered independently there, determines what's actually billed and stocked).
  Deciding whether a rejected quantity should ever enter billable/receivable state is
  explicitly deferred (Do Not) — no "Purchase Return to reject at the dock" flow exists
  in this phase (Purchase Return, spec 45, operates against a *posted invoice*, not a
  GRN).
- `purchaseOrderId` optional at the header (a GRN may be raised directly with no prior
  order). **When set, the GRN's `supplierId` must equal that Purchase Order's own
  `supplierId`** (rejected as a mismatch otherwise — a GRN cannot claim to receive
  against a different supplier's order). `purchaseOrderItemId` per line when linked,
  validated against that same order (no consolidated GRN across multiple orders — Do
  Not), **and the referenced `PurchaseOrderItem.productId` must equal this GRN line's own
  `productId`** — a line cannot be linked to an order item for a different product.
- `purchaseInvoice` back-relation is 1:1, same simplification as Delivery Challan's.

---

# Business Rules

- **Editable while `DRAFT`.** Receiving (`DRAFT → RECEIVED`) freezes the document.
- **Receiving a GRN**, in one transaction:
  1. Validates every line's product/warehouse belong to the company and are active.
  2. If `purchaseOrderId` is set, calls `purchaseOrderService.applyReceipt
     (purchaseOrderId, lines, tx)` (spec 42) with this GRN's own transaction client,
     passing each line's **combined `quantity + rejectedQuantity`** as the fulfillment
     amount `applyReceipt` adds to `receivedQuantity` — not `quantity` alone, consistent
     with the Quantity rule above.
  3. Sets `status = RECEIVED`.
  4. **Does not call the Inventory Engine** (see Goal).
- **Quantity rule**: when linked to a Purchase Order, a line's **combined**
  `quantity + rejectedQuantity` must not exceed that order line's remaining quantity
  (`purchaseOrderItem.quantity − purchaseOrderItem.receivedQuantity`) at receiving time —
  both figures represent goods that physically arrived (per the Data Model's
  `rejectedQuantity` rationale), so both consume the order's remaining quantity, even
  though only `quantity` is ever billed. Re-checked inside the transaction (the same
  race-guard pattern as Delivery Challan).
- **Status transitions**: `DRAFT → RECEIVED` (Receive), `RECEIVED → INVOICED`
  (automatic, set when a Purchase Invoice referencing this GRN is posted — spec 44's
  responsibility), `DRAFT → CANCELLED` (Cancel, only while `DRAFT` — a `RECEIVED` GRN
  represents goods that have physically entered the building; correcting a mistaken
  receipt is a manual, out-of-system process in this phase, identical posture to
  Delivery Challan's un-dispatch rule).
- **Numbering**: `grnNumber` via the Document Number Engine
  (`DocumentType.GOODS_RECEIPT_NOTE`), the standard two-step contract.
- **Company-scoped for every user**, identical posture to every prior spec in this phase.

---

# Service / Repository

Create

```text
src/modules/goods-receipt-notes/repositories/goods-receipt-note-repository.ts
src/modules/goods-receipt-notes/services/goods-receipt-note-service.ts
src/modules/goods-receipt-notes/validation/goods-receipt-note-schema.ts
src/modules/goods-receipt-notes/actions/goods-receipt-note-actions.ts
src/modules/goods-receipt-notes/components/…
src/types/goods-receipt-note.ts
```

- `goodsReceiptNoteService`: `listGoodsReceiptNotes(filters)`, `getGoodsReceiptNote(id)`,
  `createGoodsReceiptNote(input)`, `createFromPurchaseOrder(purchaseOrderId, lines)`
  (pre-fills from the order's remaining quantities), `updateGoodsReceiptNote(id, input)`
  (only while `DRAFT`), `receiveGoodsReceiptNote(id)`, `cancelGoodsReceiptNote(id)`,
  `listReceivedNotInvoiced(supplierId)` (the lookup Purchase Invoice, spec 44, reads
  from), and `markInvoiced(goodsReceiptNoteId, tx?)` — called exclusively by Purchase
  Invoice's posting flow.

---

# Validation

Zod (`goods-receipt-note-schema.ts`): `supplierId` uuid, `purchaseOrderId` optional uuid,
`grnDate` calendar date, `narration` ≤ 500, lines array ≥ 1 with `productId`/
`warehouseId` uuid, `quantity` > 0 honoring the product unit's decimal precision,
`rejectedQuantity` ≥ 0 with the same precision, `purchaseOrderItemId` optional uuid
(server re-verifies it belongs to the referenced `purchaseOrderId`, that the order's
`supplierId` matches this GRN's own `supplierId`, and that the referenced item's
`productId` matches this line's `productId`, when both are present).

---

# UI

Pages (under the `/purchase` hub, established by spec 42)

- `/purchase/receipts` — GRN list (Number, Supplier, Date, Linked Order, Status, Actions)
  with search + status/supplier filters
- `/purchase/receipts/new` — Create GRN (optionally pre-filled from a Purchase Order's
  "Create Goods Receipt Note" action)
- `/purchase/receipts/[id]` — View GRN (read-only detail, status actions: Receive /
  Cancel)
- `/purchase/receipts/[id]/edit` — Edit GRN (only reachable while `DRAFT`)

Components (`src/modules/goods-receipt-notes/components/`): GRN Table (+ filter bar), GRN
Form (product + warehouse + received/rejected-quantity line editor — no price/tax
columns), GRN Status Badge.

Wire-up

- Add a "Goods Receipt Notes" card to the `/purchase` hub page.
- Add `receipts: "Goods Receipt Notes"` to `src/constants/breadcrumbs.ts`.

---

# Security

Gated by the `purchase` permission module: `view`, `create`, `edit` (update while
`DRAFT`, Receive), `delete` not implemented (Cancel, `DRAFT`-only, is the removal path).
Company-scoped identically to spec 42.

---

# Database

New enum `GoodsReceiptNoteStatus`; new models `GoodsReceiptNote`,
`GoodsReceiptNoteItem`. One migration. Back-relations on `Company`, `FinancialYear`,
`Supplier`, `Product`, `Warehouse`, `PurchaseOrder`, `PurchaseOrderItem`, `User`. No
seeding.

---

# Code Standards

Same as spec 42 (and its Delivery Challan mirror): strict TypeScript, no `any`,
transactions for receiving (including the cross-module `applyReceipt` call), vitest
coverage for: the remaining-quantity race guard, the status matrix, `markInvoiced`'s
idempotent no-op if called twice, numbering uniqueness.

---

# Do Not

Do not implement

- **Any Inventory Engine call or stock movement** — the central scope decision of this
  spec (see Goal); Purchase Invoice (spec 44) is the sole stock-in point in this phase
- Any Voucher or GST posting
- Consolidated GRNs spanning multiple Purchase Orders
- Un-receiving / editing a `RECEIVED` GRN
- A "reject at the dock" flow that returns rejected goods to the supplier without ever
  invoicing them (Purchase Return, spec 45, operates against a posted invoice only —
  `rejectedQuantity` here is record-keeping, not a return trigger)
- Printing, PDF generation, or WhatsApp sharing (deferred identically to every prior
  spec in this phase and Phase 3)

---

# Success Criteria

Verify

- Receiving a GRN linked to a Purchase Order correctly calls `applyReceipt` atomically
  and never writes a `StockTransaction` row (grep confirms no Inventory Engine import in
  this module).
- The remaining-quantity race guard rejects a receipt that would over-receive an order
  line.
- `grnNumber` is unique per company/financial year via the Document Number Engine.
- `npx tsc --noEmit`, `npx eslint src prisma`, `npx vitest run`, and `next build` all
  pass; `/purchase/receipts*` appears in the build route table.

Feature-spec 43 (this spec) is `context/Phases/phase-tracker.md`'s Phase 4 item #41.
Feature-spec 44 (Purchase Invoice, tracker #42) depends on it via
`listReceivedNotInvoiced` and `markInvoiced`.
