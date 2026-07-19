# 42 - Purchase Orders

> Feature-spec file number 42 (spec-file numbers are sequential and never reused; 41 is
> already Debit Note, closing Phase 3). This feature is `context/Phases/phases.md`'s
> **Phase 4 — Purchase Management** and `context/Phases/phase-tracker.md`'s Phase 4 item
> **#40 Purchase Orders** — the same file-number-vs-tracker-number collision recorded for
> every spec since 31–34; disambiguated the same way here. Depends on Supplier
> Management (feature-spec 27, implemented) and Product Management (feature-spec 25,
> implemented). First of Phase 4's four documents — the mirror of `36-sales-orders.md`
> from the purchase side; read that spec's shape first, since this one differs mainly in
> having no "Quotation" predecessor and in tracking *received* rather than *delivered*
> quantity.

## Goal

Implement **Purchase Orders** for **Premgiri Books ERP** — the company's commitment to
buy from a Supplier, sitting at the head of Phase 4's document chain (Purchase Order →
Goods Receipt Note → Purchase Invoice → Purchase Return). Like `36-sales-orders.md`'s
Sales Order, a Purchase Order has **no financial or stock effect**: no Voucher, no stock
movement, no reservation. What it tracks is **fulfillment from the supplier's side** —
each line records how much has been received so far, driven by Goods Receipt Notes
(feature-spec 43) created against it.

This spec reuses every Phase 3 convention that transfers directly: the header/line shape,
engine reuse for display-only pricing/GST math, Document Number Engine numbering, and the
new `/purchase` hub page (this phase's counterpart to `/sales`).

---

# Project Context

Before implementation, review

- `36-sales-orders.md` (**read this first** — the header/line shape, `applyDelivery`-
  style fulfillment-tracking pattern this spec mirrors as `applyReceipt`, and the
  numbering/engine-reuse conventions this spec extends rather than reinvents)
- `27-supplier-management.md` (`Supplier`/`Ledger` shape — no `supplierType` tier and no
  `creditLimit` exist on `Supplier`, unlike `Customer`; `creditDays` does — see Business
  Rules; `listSelectableSuppliers()`)
- `25-product-management.md`, `30-pricing-engine.md` (this spec calls `resolvePrice` for
  display **using the product's `purchasePrice`/cost basis**, not its selling price — see
  Business Rules for exactly which value is prefilled), `33-gst-engine.md`,
  `34-document-number-engine.md` (`DocumentType.PURCHASE_ORDER`)
- `context/Phases/phase-tracker.md` (Phase 4 table; Purchase Orders' `Depends On:
  Supplier + Products`, and Goods Receipt Note's `Depends On: Purchase Order` that this
  spec must support)
- `11-role-permissions.md` (the `purchase` permission module — this phase's counterpart
  to Phase 3's `sales` module, same action set)

---

# Module Responsibilities

The Purchase Orders module is responsible for

- Purchase Order Master (Create/Edit/View/Confirm/Cancel, scoped to the active company
  and financial year)
- Per-line fulfillment tracking (`receivedQuantity`), updated only by Goods Receipt Notes
  (feature-spec 43) — never directly user-editable
- Purchase Order numbering via the Document Number Engine (`DocumentType.PURCHASE_ORDER`)
- The `/purchase` hub page (new — the first Phase 4 feature to land)
- A reusable "open purchase orders for this supplier" lookup Goods Receipt Notes (spec
  43) read from

The Purchase Orders module is **not** responsible for

- Any accounting entry, stock movement, or stock reservation — same documented
  limitation as Sales Orders (no reservation feature exists anywhere in this codebase)
- Goods Receipt Notes or Purchase Invoices themselves (specs 43, 44)
- Direct user edits to `receivedQuantity` or receipt-driven status transitions
- Any Quotation-equivalent predecessor — no "Purchase Quotation"/RFQ concept exists in
  this phase's scope (`phase-tracker.md`'s Phase 4 table has no such row)

---

# Data Model

Add to `prisma/schema.prisma` (plus `purchaseOrders PurchaseOrder[]` back-relations on
`Company`, `FinancialYear`, `Supplier`, `User`):

```text
enum PurchaseOrderStatus {
  DRAFT
  CONFIRMED
  PARTIALLY_RECEIVED
  RECEIVED
  CLOSED
  CANCELLED
}

model PurchaseOrder {
  id                     String              @id @default(uuid())
  companyId              String
  company                Company             @relation(fields: [companyId], references: [id])
  financialYearId        String
  financialYear          FinancialYear       @relation(fields: [financialYearId], references: [id])
  orderNumber            String
  orderDate              DateTime            @db.Date
  expectedDeliveryDate   DateTime?           @db.Date
  supplierId             String
  supplier               Supplier            @relation(fields: [supplierId], references: [id])
  placeOfSupplyStateCode String
  status                 PurchaseOrderStatus @default(DRAFT)
  narration              String?
  subtotal               Decimal             @db.Decimal(14, 2)
  totalDiscount           Decimal            @db.Decimal(14, 2)
  taxableAmount           Decimal            @db.Decimal(14, 2)
  totalCgst               Decimal            @db.Decimal(14, 2)
  totalSgst               Decimal            @db.Decimal(14, 2)
  totalIgst               Decimal            @db.Decimal(14, 2)
  totalCess               Decimal            @db.Decimal(14, 2)
  grandTotal              Decimal            @db.Decimal(14, 2)
  createdByUserId        String?
  createdBy              User?               @relation(fields: [createdByUserId], references: [id])
  createdAt              DateTime            @default(now())
  updatedAt              DateTime            @updatedAt

  items                PurchaseOrderItem[]
  goodsReceiptNotes    GoodsReceiptNote[]    // spec 43's back-relation target

  @@unique([companyId, financialYearId, orderNumber])
  @@index([companyId, supplierId])
  @@index([companyId, status])
}

model PurchaseOrderItem {
  id                String        @id @default(uuid())
  purchaseOrderId   String
  purchaseOrder     PurchaseOrder @relation(fields: [purchaseOrderId], references: [id])
  lineNumber        Int
  productId         String
  product           Product       @relation(fields: [productId], references: [id])
  quantity          Decimal       @db.Decimal(14, 4)
  receivedQuantity  Decimal       @db.Decimal(14, 4) @default(0)
  rate              Decimal       @db.Decimal(14, 2)
  discountPercent   Decimal       @db.Decimal(5, 2) @default(0)
  discountAmount    Decimal       @db.Decimal(14, 2) @default(0)
  ratePercent       Decimal       @db.Decimal(5, 2)
  cessPercent       Decimal       @db.Decimal(5, 2) @default(0)
  taxableAmount     Decimal       @db.Decimal(14, 2)
  cgst              Decimal       @db.Decimal(14, 2)
  sgst              Decimal       @db.Decimal(14, 2)
  igst              Decimal       @db.Decimal(14, 2)
  cess              Decimal       @db.Decimal(14, 2)
  totalAmount       Decimal       @db.Decimal(14, 2)

  @@unique([purchaseOrderId, lineNumber])
  @@index([productId])
}
```

Decisions

- Same denormalized-header-totals, snapshot-GST-rate, no-`branchId`, `createdByUserId`
  conventions as `35-quotations.md`/`36-sales-orders.md` — not repeated in full here.
- **`rate` prefills from `product.purchasePrice`** (the cost basis), not `resolvePrice`'s
  selling-price resolution — a Purchase Order is negotiating what *we* pay, which has no
  customer tier/price-list/margin-profile dimension at all. `resolvePrice` (Pricing
  Engine, spec 30) is **not called anywhere in this phase** for this reason; every
  Purchase document simply uses `product.purchasePrice` as a starting suggestion,
  always manually overridable to the actually-negotiated price (no below-cost concept
  applies to a purchase — that check is a selling-side rule only, per code-standards.md's
  Pricing Rules).
- `receivedQuantity` — maintained **exclusively** by Goods Receipt Note's posting flow
  (spec 43); this module exposes no method to set it directly. Always
  `0 ≤ receivedQuantity ≤ quantity`.
- No `supplierType`/credit-limit fields to read (unlike Sales Order's customer, per spec
  27's deliberate omissions) — `Supplier.creditDays` (payment terms) is advisory display
  only on Purchase Invoice (spec 44), not this document.

---

# Business Rules

- **Editable while `DRAFT`.** Confirming (`DRAFT → CONFIRMED`) freezes the header and
  line quantities/pricing — only `status` (documented transitions) and the receipt-
  driven `receivedQuantity` may change afterward.
- **Status transitions**: `DRAFT → CONFIRMED` (Confirm), `CONFIRMED →
  PARTIALLY_RECEIVED` (automatic, first Goods Receipt Note posting that leaves at least
  one line with `0 < receivedQuantity < quantity`), `→ RECEIVED` (automatic, every line's
  `receivedQuantity === quantity`), `RECEIVED → CLOSED` (Close, manual), any of `DRAFT`/
  `CONFIRMED` `→ CANCELLED` (Cancel — only while no Goods Receipt Note has been posted
  against it, identical posture to Sales Order's cancellation-after-delivery rule).
- **Line calculation**: quantity/discount entered directly; `rate` prefilled from
  `product.purchasePrice` (always overridable); `ratePercent`/`cessPercent` copied from
  the product's `GstRate` at line-add time (the same point-in-time-snapshot reasoning as
  every Phase 3 document); tax computed via `gstEngine.calculateLine`/`calculateDocument`
  for display only — no posting. Missing HSN is a **non-blocking** warning at this stage
  (identical posture to Quotation/Sales Order; it becomes a hard block only at Purchase
  Invoice, spec 44).
- **Numbering**: `orderNumber` via the Document Number Engine
  (`DocumentType.PURCHASE_ORDER`), the standard two-step contract.
- **Company-scoped for every user**, identical posture to every Phase 3 spec.

---

# Service / Repository

Create

```text
src/modules/purchase-orders/repositories/purchase-order-repository.ts
src/modules/purchase-orders/services/purchase-order-service.ts
src/modules/purchase-orders/validation/purchase-order-schema.ts
src/modules/purchase-orders/actions/purchase-order-actions.ts
src/modules/purchase-orders/components/…
src/types/purchase-order.ts
```

- `purchaseOrderService`: `listPurchaseOrders(filters)`, `getPurchaseOrder(id)`,
  `createPurchaseOrder(input)`, `updatePurchaseOrder(id, input)` (only while `DRAFT`),
  `confirmPurchaseOrder(id)`, `closePurchaseOrder(id)`, `cancelPurchaseOrder(id)`,
  `listOpenForSupplier(supplierId)` (the lookup Goods Receipt Notes, spec 43, read from),
  and `applyReceipt(purchaseOrderId, lines, tx?)` — the **only** entry point that
  increments `receivedQuantity` and recomputes status; called exclusively by Goods
  Receipt Note's posting flow, mirroring `SalesOrder.applyDelivery`'s `tx?` contract.

---

# Validation

Zod (`purchase-order-schema.ts`) — the same shape as `sales-order-schema.ts` with
`supplierId` in place of `customerId`, and no `resolvePrice`-derived default (`rate`
defaults from `product.purchasePrice` client-side, still server-validated as a plain
≥ 0, ≤ 2-decimal number).

---

# UI

Pages (new **Purchase** sidebar section — the first Phase 4 feature to land, per
`ui-context.md`'s existing Left Sidebar list which already names "Purchase" alongside
"Sales")

- `/purchase` — Purchase hub page (the `/sales` hub convention: one card per Phase 4
  document type; only "Purchase Orders" wired this task)
- `/purchase/orders` — Purchase Order list (Number, Supplier, Date, Status, Fulfillment,
  Grand Total, Actions) with search + status/supplier filters
- `/purchase/orders/new` — Create Purchase Order
- `/purchase/orders/[id]` — View Purchase Order (read-only detail, per-line received/
  pending quantity, status actions: Confirm / Close / Cancel / "Create Goods Receipt
  Note")
- `/purchase/orders/[id]/edit` — Edit Purchase Order (only reachable while `DRAFT`)

Components (`src/modules/purchase-orders/components/`): Purchase Order Table (+ filter
bar), Purchase Order Form (reusing the `DocumentLineEditor` shared component if extracted
per spec 36's note), Purchase Order Status Badge, Fulfillment Progress indicator.

Wire-up

- New Sidebar entry "Purchase" linking to `/purchase`.
- Add `purchase: "Purchase"` and `purchase-orders: "Purchase Orders"` to
  `src/constants/breadcrumbs.ts`.

---

# Security

Gated by the `purchase` permission module (spec 11): `view`, `create`, `edit` (update
while `DRAFT`, Confirm, Close), `approve` for Cancel-after-Confirm, `delete` not
implemented. Company-scoped identically to every Phase 3 spec.

---

# Database

New enum `PurchaseOrderStatus`; new models `PurchaseOrder`, `PurchaseOrderItem`. One
migration. Back-relations on `Company`, `FinancialYear`, `Supplier`, `Product`, `User`.
No seeding.

---

# Code Standards

Same as `36-sales-orders.md`: strict TypeScript, no `any`, no GST arithmetic outside the
GST Engine (no Pricing Engine call at all in this phase — see Data Model), transactions
for header+items writes and for `applyReceipt`, vitest coverage for: the full status
matrix including the two automatic transitions driven by `applyReceipt`, cancellation-
blocked-after-receipt, numbering uniqueness.

---

# Do Not

Do not implement

- Stock reservation of any kind
- Any Voucher or stock movement (Purchase Invoice, spec 44, is the first Phase 4
  document to touch either engine)
- Goods Receipt Notes or Purchase Invoices themselves (specs 43, 44)
- A "Purchase Quotation"/RFQ predecessor document (no such row exists in the tracker)
- Printing, PDF generation, or WhatsApp sharing (same deferral posture as Phase 3)

---

# Success Criteria

Verify

- A Purchase Order can be created for an active Supplier with 1+ lines, `rate` prefilled
  from `product.purchasePrice` and freely overridable; line/document totals match
  `calculateLine`/`calculateDocument`'s output exactly.
- Confirming an order freezes header/line edits; the documented status matrix (including
  the two automatic transitions triggered by a simulated `applyReceipt` call) behaves
  correctly; cancellation after any receipt is rejected.
- `orderNumber` is unique per company/financial year via the Document Number Engine.
- `npx tsc --noEmit`, `npx eslint src prisma`, `npx vitest run`, and `next build` all
  pass; `/purchase` and `/purchase/orders*` appear in the build route table.

Feature-spec 42 (this spec) is `context/Phases/phase-tracker.md`'s Phase 4 item #40.
Feature-spec 43 (Goods Receipt Note, tracker #41) depends on it via `applyReceipt` and
`listOpenForSupplier`.
