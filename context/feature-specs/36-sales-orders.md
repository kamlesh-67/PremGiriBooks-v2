# 36 - Sales Orders

> Feature-spec file number 36. This feature is `context/Phases/phases.md`'s **Phase 3 —
> Sales Management** and `context/Phases/phase-tracker.md`'s Phase 3 item **#34 Sales
> Orders**. Depends on Quotations (feature-spec 35) for the conversion flow, and on
> Customer Management (26) / Product Management (25) / Pricing Engine (30) the same way
> Quotations does. Second of the seven Phase 3 documents.

## Goal

Implement **Sales Orders** for **Premgiri Books ERP** — the customer's confirmed
commitment to buy, sitting between the non-binding Quotation (feature-spec 35) and the
dispatch-tracking Delivery Challan (feature-spec 37). Like a Quotation, a Sales Order has
**no financial or stock effect**: no Voucher, no stock movement, no reservation. What it
adds over a Quotation is **fulfillment tracking** — each line records how much has been
delivered so far, driven by Delivery Challans created against it, so the order's own status
reflects real progress (`PARTIALLY_DELIVERED` / `DELIVERED`).

This spec reuses every shared convention feature-spec 35 established (header shape, line
shape, engine reuse for display-only pricing/GST math, Document Number Engine numbering,
the `/sales` hub) — it does not re-derive them.

---

# Project Context

Before implementation, review

- `35-quotations.md` (**read this first** — the header/line shape, engine-reuse pattern,
  numbering contract, and `/sales` hub this spec extends rather than reinvents)
- architecture-context.md (Document Driven lifecycle), code-standards.md (Inventory Rules
  — "no stock reservation" is not a stated rule, but no reservation feature exists in
  `32-inventory-engine.md` either, so none is invented here — see Do Not)
- `context/Phases/phase-tracker.md` (Phase 3 table; Sales Orders' own `Depends On:
  Quotations`, and Delivery Challans' `Depends On: Sales Orders` that this spec must
  support)
- `26-customer-management.md`, `25-product-management.md`, `30-pricing-engine.md`,
  `33-gst-engine.md`, `34-document-number-engine.md` (`DocumentType.SALES_ORDER`)

---

# Module Responsibilities

The Sales Orders module is responsible for

- Sales Order Master (Create/Edit/View/Confirm/Cancel, scoped to the active company and
  financial year)
- `createFromQuotation(quotationId)` — the conversion service Quotations (spec 35) calls;
  copies customer, place of supply, and lines (pricing/GST recomputed at order time, not
  copied verbatim — see Business Rules) into a new `DRAFT` Sales Order, and links back via
  `SalesOrder.quotationId`
- Per-line fulfillment tracking (`deliveredQuantity`), updated only by Delivery Challans
  (feature-spec 37) — never directly user-editable
- Sales Order numbering via the Document Number Engine (`DocumentType.SALES_ORDER`)
- A reusable "open sales orders for this customer" lookup Delivery Challans (spec 37) read
  from

The Sales Orders module is **not** responsible for

- Any accounting entry, stock movement, or stock reservation — confirmed orders reserve
  nothing; a Sales Invoice (spec 38) may outsell a confirmed order's remaining stock and
  the system will not stop it (no reservation feature exists anywhere in this codebase;
  see Do Not)
- Delivery Challans or Sales Invoices themselves (specs 37, 38)
- Direct user edits to `deliveredQuantity` or delivery-driven status transitions

---

# Data Model

Add to `prisma/schema.prisma` (plus `salesOrders SalesOrder[]` back-relations on
`Company`, `FinancialYear`, `Customer`, `User`):

```text
enum SalesOrderStatus {
  DRAFT
  CONFIRMED
  PARTIALLY_DELIVERED
  DELIVERED
  CLOSED
  CANCELLED
}

model SalesOrder {
  id                     String           @id @default(uuid())
  companyId              String
  company                Company          @relation(fields: [companyId], references: [id])
  financialYearId        String
  financialYear          FinancialYear    @relation(fields: [financialYearId], references: [id])
  orderNumber            String
  orderDate              DateTime         @db.Date
  expectedDeliveryDate   DateTime?        @db.Date
  customerId             String
  customer               Customer         @relation(fields: [customerId], references: [id])
  placeOfSupplyStateCode String
  status                 SalesOrderStatus @default(DRAFT)
  narration              String?
  quotationId            String?
  quotation              Quotation?       @relation(fields: [quotationId], references: [id])
  subtotal               Decimal          @db.Decimal(14, 2)
  totalDiscount           Decimal         @db.Decimal(14, 2)
  taxableAmount           Decimal         @db.Decimal(14, 2)
  totalCgst               Decimal         @db.Decimal(14, 2)
  totalSgst               Decimal         @db.Decimal(14, 2)
  totalIgst               Decimal         @db.Decimal(14, 2)
  totalCess               Decimal         @db.Decimal(14, 2)
  grandTotal              Decimal         @db.Decimal(14, 2)
  createdByUserId        String?
  createdBy              User?            @relation(fields: [createdByUserId], references: [id])
  createdAt              DateTime         @default(now())
  updatedAt              DateTime         @updatedAt

  items             SalesOrderItem[]
  deliveryChallans  DeliveryChallan[] // spec 37's back-relation target

  @@unique([companyId, financialYearId, orderNumber])
  @@index([companyId, customerId])
  @@index([companyId, status])
  @@index([quotationId])
}

model SalesOrderItem {
  id                String     @id @default(uuid())
  salesOrderId      String
  salesOrder        SalesOrder @relation(fields: [salesOrderId], references: [id])
  lineNumber        Int
  productId         String
  product           Product    @relation(fields: [productId], references: [id])
  quantity          Decimal    @db.Decimal(14, 4)
  deliveredQuantity Decimal    @db.Decimal(14, 4) @default(0)
  rate              Decimal    @db.Decimal(14, 2)
  discountPercent   Decimal    @db.Decimal(5, 2) @default(0)
  discountAmount    Decimal    @db.Decimal(14, 2) @default(0)
  ratePercent       Decimal    @db.Decimal(5, 2)
  cessPercent       Decimal    @db.Decimal(5, 2) @default(0)
  taxableAmount     Decimal    @db.Decimal(14, 2)
  cgst              Decimal    @db.Decimal(14, 2)
  sgst              Decimal    @db.Decimal(14, 2)
  igst              Decimal    @db.Decimal(14, 2)
  cess              Decimal    @db.Decimal(14, 2)
  totalAmount       Decimal    @db.Decimal(14, 2)

  @@unique([salesOrderId, lineNumber])
  @@index([productId])
}
```

Decisions

- Same denormalized-header-totals, snapshot-GST-rate, no-`branchId`, `createdByUserId`
  conventions as `35-quotations.md` — not repeated in full here.
- `quotationId` — optional (a Sales Order may be created directly, with no prior
  Quotation — a common shortcut for repeat/known customers). No uniqueness constraint on
  the pair (a Quotation may spawn more than one order, per spec 35's Business Rules).
- `deliveredQuantity` — maintained **exclusively** by Delivery Challan's posting flow
  (spec 37); the Sales Order service exposes no method to set it directly. Always
  `0 ≤ deliveredQuantity ≤ quantity` (enforced by the writer, spec 37, not re-validated
  here since this module never writes it).
- `expectedDeliveryDate` — optional, plain data; no scheduling/reminder feature is built
  from it (none was asked for).

---

# Business Rules

- **`createFromQuotation(quotationId)`**: only from an `ACCEPTED`/`SENT` Quotation (spec
  35's convert rule). Copies `customerId`, `placeOfSupplyStateCode`, and each line's
  `productId`/`quantity`/`discountPercent`/`discountAmount`. **Rate and GST are
  re-resolved at order-creation time** (fresh `resolvePrice`/`calculateLine` calls), not
  copied from the quotation verbatim — a quotation may be days or weeks old and prices
  may have moved; the quotation's own snapshot stays intact and unaffected. The new order
  is created `DRAFT`.
- **Editable while `DRAFT`.** Confirming (`DRAFT → CONFIRMED`) freezes the header and line
  quantities/pricing — from that point on, only `status` (via the documented transitions)
  and the delivery-driven `deliveredQuantity` may change; no update API accepts a
  `CONFIRMED`-or-later order's id for a header/line edit.
- **Status transitions**: `DRAFT → CONFIRMED` (Confirm), `CONFIRMED → PARTIALLY_DELIVERED`
  (automatic, recomputed by every `applyDelivery` call: triggered whenever **any** line has
  `deliveredQuantity > 0` while the order as a whole is not yet fully delivered — the
  trigger is order-wide progress, not a single line's own partial state, so a line that is
  fully delivered while a sibling line remains untouched or only partially delivered still
  counts), `→ DELIVERED` (automatic, set only when **every** line's `deliveredQuantity ===
  quantity`) — an order can never remain `CONFIRMED` once any delivery has been applied to
  it; from that point on it is always `PARTIALLY_DELIVERED` or `DELIVERED`, `DELIVERED →
  CLOSED` (Close, a manual staff action confirming no further action is expected — e.g., no
  invoice will follow, or invoicing is tracked elsewhere), any of `DRAFT`/`CONFIRMED` `→
  CANCELLED` (Cancel — **only while no Delivery Challan has been posted against it**; once
  any delivery exists, cancellation is rejected with a friendly error naming the challan).
- **Line calculation and pricing/HSN posture** — identical to `35-quotations.md`'s rules,
  applied at order-creation/edit time (server-side, engine-computed, never trusted from
  the client; below-cost is a non-blocking warning; missing HSN is a non-blocking
  warning).
- **Numbering**: `orderNumber` via the Document Number Engine (`DocumentType.SALES_ORDER`),
  same two-step contract as every document in this phase.
- **Company-scoped for every user**, identical posture to spec 35.

---

# Service / Repository

Create

```text
src/modules/sales-orders/repositories/sales-order-repository.ts
src/modules/sales-orders/services/sales-order-service.ts
src/modules/sales-orders/validation/sales-order-schema.ts
src/modules/sales-orders/actions/sales-order-actions.ts
src/modules/sales-orders/components/…
src/types/sales-order.ts
```

- `salesOrderService`: `listSalesOrders(filters)`, `getSalesOrder(id)`,
  `createSalesOrder(input)`, `createFromQuotation(quotationId)`, `updateSalesOrder(id,
  input)` (only while `DRAFT`), `confirmSalesOrder(id)`, `closeSalesOrder(id)`,
  `cancelSalesOrder(id)`, `listOpenForCustomer(customerId)` (`CONFIRMED`/
  `PARTIALLY_DELIVERED` orders — the lookup Delivery Challans, spec 37, read from), and
  `applyDelivery(salesOrderId, lines, tx?)` — the **only** entry point that increments
  `deliveredQuantity` and recomputes status; called exclusively by Delivery Challan's
  posting flow (spec 37), accepting an optional transaction client so it participates in
  the challan's own transaction (the Voucher Engine `tx?` convention).
- Repository → Service layering per the established convention; Decimal → number
  normalization at the repository boundary.

---

# Validation

Zod (`sales-order-schema.ts`) — identical shape to `quotation-schema.ts` (customer,
dates, place of supply, narration, lines), plus `expectedDeliveryDate` as an optional
calendar date ≥ `orderDate`.

---

# UI

Pages (under the `/sales` hub established by spec 35)

- `/sales/orders` — Sales Order list (Number, Customer, Date, Status, Fulfillment —
  a simple "3/5 lines delivered" indicator, Grand Total, Actions) with search + status/
  customer filters
- `/sales/orders/new` — Create Sales Order (optionally pre-filled when navigated from a
  Quotation's "Convert to Sales Order" action)
- `/sales/orders/[id]` — View Sales Order (read-only detail, per-line delivered/pending
  quantity, status actions: Confirm / Close / Cancel / "Create Delivery Challan" —
  gated by status)
- `/sales/orders/[id]/edit` — Edit Sales Order (only reachable while `DRAFT`)

Components (`src/modules/sales-orders/components/`): Sales Order Table (+ filter bar),
Sales Order Form (reusing the line-item editor sub-component pattern from
`35-quotations.md`'s Quotation Form — extract a shared `DocumentLineEditor` component
under `src/components/sales/` if the shape is identical enough to avoid duplication;
decide during implementation and record which), Sales Order Status Badge, Fulfillment
Progress indicator.

Wire-up

- Add a "Sales Orders" card to the `/sales` hub page.
- Add `orders: "Sales Orders"` to `src/constants/breadcrumbs.ts`.

---

# Security

Gated by the `sales` permission module: `view`, `create`, `edit` (update while `DRAFT`,
Confirm, Close), `approve` for Cancel-after-Confirm (a reversal of a customer commitment,
treated as needing the stronger action, consistent with spec 35's Accept/Reject posture),
`delete` not implemented. Company-scoped identically to spec 35.

---

# Database

New enum `SalesOrderStatus`; new models `SalesOrder`, `SalesOrderItem`. One migration.
Back-relations on `Company`, `FinancialYear`, `Customer`, `Product`, `Quotation`, `User`.
No seeding.

---

# Code Standards

Same as `35-quotations.md`: strict TypeScript, no `any`, no GST/pricing arithmetic outside
the two engines, transactions for header+items writes and for `applyDelivery`, vitest
coverage for: `createFromQuotation`'s re-resolution behavior (rate/GST differ from the
source quotation when prices moved), the full status matrix including the two automatic
transitions driven by `applyDelivery`, cancellation-blocked-after-delivery, numbering
uniqueness.

---

# Do Not

Do not implement

- Stock reservation of any kind — no such feature exists in `32-inventory-engine.md`;
  a Sales Order's "commitment" is a paper commitment only, and this is a deliberate,
  documented limitation, not an oversight
- Any Voucher or stock movement (Sales Invoice, spec 38, is the first document to touch
  either engine)
- Delivery Challans or Sales Invoices themselves (specs 37, 38)
- Printing, PDF generation, or WhatsApp sharing (deferred identically to spec 35's Do Not)
- Consolidated/multi-order invoicing or delivery (one Sales Order per Delivery Challan
  relationship only — spec 37's own scope)
- A scheduled reminder for `expectedDeliveryDate` (no job infra exists)

---

# Success Criteria

Verify

- `createFromQuotation` produces a `DRAFT` Sales Order whose lines re-resolve price/GST
  independently of the source quotation's stored snapshot, with the `quotationId`
  back-reference set.
- Confirming an order freezes header/line edits; the documented status matrix (including
  the two automatic transitions triggered by a simulated `applyDelivery` call) behaves
  correctly; cancellation after any delivery is rejected.
- `orderNumber` is unique per company/financial year via the Document Number Engine.
- `npx tsc --noEmit`, `npx eslint src prisma`, `npx vitest run`, and `next build` all pass;
  `/sales/orders*` appears in the build route table.

Feature-spec 36 (this spec) is `context/Phases/phase-tracker.md`'s Phase 3 item #34.
Feature-spec 37 (Delivery Challans, tracker #35) depends on it via `applyDelivery` and
`listOpenForCustomer`.
