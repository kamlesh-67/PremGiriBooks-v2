# 35 - Quotations

> Feature-spec file number 35 (spec-file numbers are sequential and never reused; 34 is
> already Document Number Engine). This feature is `context/Phases/phases.md`'s **Phase 3
> — Sales Management** and `context/Phases/phase-tracker.md`'s Phase 3 item **#33
> Quotations** — the collision between feature-spec numbering and tracker numbering is the
> same one recorded in `progress-tracker.md`'s numbering-schemes note; this header exists
> to disambiguate it exactly as specs 31–34 did. Depends on Customer Management (feature-
> spec 26, implemented), Product Management (feature-spec 25, implemented), and the
> Pricing Engine (feature-spec 30, implemented). First of the seven Phase 3 documents —
> establishes the Sales module's shared conventions every later spec in this phase reuses.

## Goal

Implement **Quotations** for **Premgiri Books ERP** — the first, non-binding step of the
Sales document chain (`architecture-context.md` Document Driven: Quotation → Sales Order →
Delivery Challan → Sales Invoice). A Quotation is a priced offer to a customer with no
financial or stock effect: no Voucher, no stock movement, no GST register entry. It exists
to be sent, negotiated, and — if accepted — converted into a Sales Order (feature-spec 36).

This spec also establishes, for the whole Sales phase, the conventions every later document
in this phase reuses verbatim: the document-header shape (company/FY/customer/place-of-
supply), the line-item shape (product/quantity/rate/discount + engine-computed GST), the
"Engine Driven" reuse of `resolvePrice` (Pricing Engine, spec 30) and `calculateLine`/
`calculateDocument` (GST Engine, spec 33) for **display-only** tax math (no posting), the
Document Number Engine (spec 34) integration, and the `/sales` hub page. Later specs in
this phase (36–41) reference this one for those shared shapes rather than re-deriving them.

---

# Project Context

Before implementation, review

- PRD.md, project-overview.md (Sales Management feature list), architecture-context.md
  (Document Driven lifecycle, Engine Driven principle, Customer Architecture), code-
  standards.md (Pricing Rules, GST Rules — "no screen may calculate selling prices/GST
  directly"), ui-context.md (Sales sidebar section, Billing Screen, Printing), ai-workflow-
  rules.md, progress-tracker.md
- `context/Phases/phase-tracker.md` (Phase 3 — Sales Management, the full #33–#39 table
  and each item's `Depends On` column, which this spec and specs 36–41 follow exactly)
- `26-customer-management.md` (`Customer`/`Ledger` shape, `listSelectableCustomers()` —
  Quotations require an existing Permanent Customer; see Business Rules)
- `25-product-management.md` (`Product` shape — `unitId`, `hsnCodeId`, `gstRateId`,
  `sellingPrice`, `purchasePrice`; `listSelectableProducts()`)
- `30-pricing-engine.md` (`resolvePrice(input)` — the source-order price resolution this
  spec calls per line, read-only, no posting)
- `33-gst-engine.md` (`calculateLine`/`calculateDocument`/`determineSupplyType`/
  `isHsnRequired`/`GST_STATE_CODES` — pure calculation functions this spec calls for
  **display only**; no GST register or return exists yet to post into)
- `34-document-number-engine.md` (`DocumentType.QUOTATION`, `ensureSequence`/
  `generateNumber`/`previewNextNumber` — this spec's numbering source)
- `11-role-permissions.md` (the `sales` permission module, actions view/create/edit/
  delete/approve/export — reused by every Phase 3 spec)

---

# Module Responsibilities

The Quotations module is responsible for

- Quotation Master (Create/Edit/View/Send/Accept/Reject/Cancel, scoped to the active
  company and financial year)
- Line-level price resolution display (calls Pricing Engine `resolvePrice`, never
  recomputes it) and line/document-level GST display (calls GST Engine `calculateLine`/
  `calculateDocument`, never recomputes it)
- Quotation numbering via the Document Number Engine (`DocumentType.QUOTATION`)
- The `/sales` hub page (new — the first Phase 3 feature to land)
- Conversion entry point: "Convert to Sales Order" (creates the `SalesOrder`/
  `SalesOrderItem` rows; feature-spec 36 owns the conversion service method itself, this
  module exposes the calling action and stores the resulting back-reference)

The Quotations module is **not** responsible for

- Any accounting entry, stock movement, or GST register/return — a Quotation is a
  non-binding offer; those begin at Sales Invoice (feature-spec 38)
- Sales Orders, Delivery Challans, or any later document's own lifecycle
- Ad-hoc "prospect" quoting for a party with no Customer master row (see Business Rules —
  an explicit, documented limitation, not an oversight)
- Discount **schemes**, coupons, or promotional rules beyond a plain per-line percentage/
  amount (no such master exists anywhere in this codebase)
- Printing, PDF generation, or WhatsApp sharing (see Do Not)
- Barcode scanning UX (`phase-tracker.md` #76, a later, separate feature; this spec's
  product picker is a text/name search only)

---

# Data Model

Add to `prisma/schema.prisma` (plus `quotations Quotation[]` back-relations on `Company`,
`FinancialYear`, `Customer`, `User` — see `createdByUserId`):

```text
enum QuotationStatus {
  DRAFT
  SENT
  ACCEPTED
  REJECTED
  EXPIRED
  CANCELLED
}

model Quotation {
  id                   String          @id @default(uuid())
  companyId            String
  company              Company         @relation(fields: [companyId], references: [id])
  financialYearId      String
  financialYear        FinancialYear   @relation(fields: [financialYearId], references: [id])
  quotationNumber      String
  quotationDate        DateTime        @db.Date
  validUntil           DateTime?       @db.Date
  customerId           String
  customer             Customer        @relation(fields: [customerId], references: [id])
  placeOfSupplyStateCode String
  status               QuotationStatus @default(DRAFT)
  narration            String?
  subtotal             Decimal         @db.Decimal(14, 2)
  totalDiscount         Decimal        @db.Decimal(14, 2)
  taxableAmount         Decimal        @db.Decimal(14, 2)
  totalCgst             Decimal        @db.Decimal(14, 2)
  totalSgst             Decimal        @db.Decimal(14, 2)
  totalIgst             Decimal        @db.Decimal(14, 2)
  totalCess             Decimal        @db.Decimal(14, 2)
  grandTotal            Decimal        @db.Decimal(14, 2)
  createdByUserId       String?
  createdBy             User?          @relation(fields: [createdByUserId], references: [id])
  createdAt             DateTime       @default(now())
  updatedAt             DateTime       @updatedAt

  items      QuotationItem[]
  salesOrders SalesOrder[] // spec 36's back-relation target

  @@unique([companyId, financialYearId, quotationNumber])
  @@index([companyId, customerId])
  @@index([companyId, status])
}

model QuotationItem {
  id              String    @id @default(uuid())
  quotationId     String
  quotation       Quotation @relation(fields: [quotationId], references: [id])
  lineNumber      Int
  productId       String
  product         Product   @relation(fields: [productId], references: [id])
  quantity        Decimal   @db.Decimal(14, 4)
  rate            Decimal   @db.Decimal(14, 2)
  discountPercent Decimal   @db.Decimal(5, 2) @default(0)
  discountAmount  Decimal   @db.Decimal(14, 2) @default(0)
  ratePercent     Decimal   @db.Decimal(5, 2)
  cessPercent     Decimal   @db.Decimal(5, 2) @default(0)
  taxableAmount   Decimal   @db.Decimal(14, 2)
  cgst            Decimal   @db.Decimal(14, 2)
  sgst            Decimal   @db.Decimal(14, 2)
  igst            Decimal   @db.Decimal(14, 2)
  cess            Decimal   @db.Decimal(14, 2)
  totalAmount     Decimal   @db.Decimal(14, 2)

  @@unique([quotationId, lineNumber])
  @@index([productId])
}
```

Decisions

- **Header totals are a denormalized snapshot**, recomputed via `calculateDocument`
  (GST Engine) every time lines are saved while the quotation is editable, and simply
  **not recomputed** once terminal (see Business Rules) — mirrors `Voucher.totalAmount`'s
  "denormalized for list rendering only" convention, except here the lines themselves
  (not a separate entries table) are the source of truth, so header totals are a pure
  function of the lines, always regenerated on write, never hand-edited.
- `placeOfSupplyStateCode` — one of `GST_STATE_CODES` (GST Engine, spec 33). Defaults to
  the customer's assigned state when it can be confidently mapped; since `Customer.state`
  is free text (spec 26 deferred formalizing it), the picker defaults to the **company's**
  state code and requires explicit confirmation/change — never silently guessed from free
  text. Determines `supplyType` (`determineSupplyType`) fed into every line's
  `calculateLine` call.
- `rate` — the line's resolved-or-overridden unit price (2 decimals); `ratePercent`/
  `cessPercent` — copied from the product's `GstRate` at the time the line is added (a
  quotation is a point-in-time offer; a later GST-rate change must not silently reprice an
  open quotation — the same "snapshot at transaction time" reasoning `pricing-engine.md`
  applies to `unitCost`).
- No `branchId` (Branch Management, feature-spec 12, still unimplemented — same forward-
  noted-migration posture as every engine spec in Phase 2).
- `createdByUserId` — reuses the shared-field convention already established for `Voucher`
  (spec 31); every document in this phase records it the same way, for the same audit-trail
  reason, without retrofitting anything outside this phase's own new tables.

---

# Business Rules

- **Requires an existing Permanent Customer.** `customerId` must reference an active
  Customer (spec 26) belonging to the same company. Quoting an unregistered prospect with
  no Customer master row is **out of scope** — spec 26 explicitly scoped Quick/Walk-in
  customers as a Sales Invoice-only concept (feature-spec 38); inventing a parallel
  "prospect" concept here would contradict that. A business wanting to quote a prospect
  creates a lightweight Customer record first (already a two-field-minimum operation per
  spec 26's form).
- **Editable while `DRAFT` or `SENT`.** Every field (customer, dates, place of supply,
  lines) may change; totals recompute on every save. Terminal states — `ACCEPTED`,
  `REJECTED`, `EXPIRED`, `CANCELLED` — are immutable (no update API accepts a terminal
  quotation's id; only the documented status transitions below apply).
- **Status transitions** (each a dedicated action, not a generic "update status" field):
  `DRAFT → SENT` (Send), `SENT → ACCEPTED` / `SENT → REJECTED` (customer's response,
  recorded by staff), any non-terminal state `→ CANCELLED` (Cancel, staff-initiated), and
  `SENT → EXPIRED` when read past `validUntil` (computed at read time for display — **not**
  a scheduled job; no background-job infra exists anywhere in this codebase, so "expired"
  is a derived label, not a stored transition, until an actual attempted Accept/Convert
  after `validUntil` hard-rejects with a friendly error asking to re-quote).
- **`validUntil`**, when set, must be on or after `quotationDate`.
- **Numbering**: `quotationNumber` generated by the Document Number Engine
  (`DocumentType.QUOTATION`) inside the create transaction, following the `ensureSequence`-
  before-transaction / `generateNumber`-inside-transaction two-step contract (spec 34).
  Never client-supplied; never regenerated on edit.
- **Line calculation** (server-side only, never trusted from the client): for each line,
  `taxableAmount_pre = quantity × rate − discountAmount − (discountPercent% of quantity ×
  rate)` when both a percent and an amount are given (percent applied first, then the flat
  amount subtracted — documented order, since both are optional and independent), then
  `GstEngine.calculateLine({ amount: taxableAmount_pre, isInclusive: false, ratePercent,
  cessPercent, supplyType, isReverseCharge: false })` produces the stored tax breakdown.
  Document totals come from `GstEngine.calculateDocument(lines)` (rate/cess-pair grouping,
  round-per-line-sum-the-rounded-lines policy — spec 33 verbatim).
- **Pricing**: adding a line calls `PricingEngine.resolvePrice({ companyId, productId,
  quantity, customerId, asOfDate: quotationDate })` to prefill `rate`; the resolved value is
  always **overridable** (a quotation is a negotiation instrument — no permission gate on
  override here, unlike Sales Invoice's stricter posture, since nothing posts yet). A
  below-cost resolved or overridden rate surfaces `isBelowCost` as a non-blocking UI
  warning only (code-standards.md "requires warning **or** approval" — a quotation has
  nothing to approve into yet; the approval gate belongs to Sales Invoice, spec 38).
- **HSN**: `isHsnRequired` (GST Engine) flags a line missing an HSN code as a warning, not
  a hard block — a quotation may legitimately be sent before HSN is finalized on the
  product master; Sales Invoice (spec 38) is where this becomes a hard rule.
- **Convert to Sales Order**: only from `ACCEPTED` (or, pragmatically, `SENT` — a business
  may skip the formal Accept step; both are allowed, `DRAFT`/`REJECTED`/`EXPIRED`/
  `CANCELLED` are not). Calls `salesOrderService.createFromQuotation(quotationId)` (spec
  36's method — this module does not construct `SalesOrder` rows itself). A Quotation may
  be converted more than once (partial acceptance across multiple orders over time is a
  real business need); no unique constraint enforces "at most one conversion."
- **Company-scoped for every user.** Derive the active company and financial year
  server-side (`getCurrentCompanyUser()`, `getCurrentFinancialYear()`); never accept
  either from client input. A cross-company id resolves as not-found.

---

# Service / Repository

Create

```text
src/modules/quotations/repositories/quotation-repository.ts
src/modules/quotations/services/quotation-service.ts
src/modules/quotations/validation/quotation-schema.ts
src/modules/quotations/actions/quotation-actions.ts
src/modules/quotations/components/…
src/types/quotation.ts
```

- `quotationService`: `listQuotations(filters)` (status/customer/date-range/search on
  quotationNumber), `getQuotation(id)`, `createQuotation(input)` (validates lines, calls
  GST/Pricing engines for the computed fields, generates the number, persists header +
  items in one transaction), `updateQuotation(id, input)` (only while `DRAFT`/`SENT`,
  recomputes totals), `sendQuotation(id)`, `acceptQuotation(id)`, `rejectQuotation(id)`,
  `cancelQuotation(id)`.
- All Prisma access lives in `quotation-repository.ts`; the service owns validation,
  engine calls, and transitions (Repository → Service layering, the spec-14 convention).
  Decimal → number normalization at the repository boundary.
- Server Actions use the shared `runAction` envelope.

---

# Validation

Zod (`quotation-schema.ts`): `customerId` uuid (server re-verifies active + same company),
`quotationDate`/`validUntil` calendar dates (the `financial-year-schema.ts` convention),
`placeOfSupplyStateCode` against the `GST_STATE_CODES` literal tuple, `narration` ≤ 500,
lines array ≥ 1 with `productId` uuid, `quantity` > 0 (unit-decimal-precision checked
server-side after the product/unit loads, the `pricing-engine.ts` convention), `rate` ≥ 0
with ≤ 2 decimals, `discountPercent` 0–100 with ≤ 2 decimals, `discountAmount` ≥ 0 with ≤ 2
decimals.

---

# UI

Pages (new **Sales** sidebar section — the first Phase 3 feature to land)

- `/sales` — Sales hub page (the `/masters` hub convention: one card per Phase 3 document
  type; only "Quotations" is wired this task, the rest added by specs 36–41 as they land)
- `/sales/quotations` — Quotation list (Number, Customer, Date, Valid Until, Grand Total —
  `font-financial` right-aligned, Status badge, Actions) with search + status/customer
  filters (`ProductFilterBar` URL-state pattern)
- `/sales/quotations/new` — Create Quotation
- `/sales/quotations/[id]` — View Quotation (read-only detail + status actions: Send /
  Accept / Reject / Cancel / Convert to Sales Order, each gated by current status)
- `/sales/quotations/[id]/edit` — Edit Quotation (only reachable while `DRAFT`/`SENT`)

Components (`src/modules/quotations/components/`): Quotation Table (+ filter bar),
Quotation Form (header section + a line-item editor sub-component — product picker calling
`listSelectableProducts()`, live-resolves price via a Server Action wrapping
`resolvePrice`, live GST/discount computation via a Server Action wrapping
`calculateLine`/`calculateDocument` so the browser never does tax math itself — the Engine
Driven principle applies to Server Actions, not just Prisma access), Quotation Status
Badge, Quotation Totals Summary.

Wire-up

- New Sidebar entry "Sales" linking to `/sales` (`ui-context.md`'s Left Sidebar list).
- Add `sales: "Sales"` and `quotations: "Quotations"` to `src/constants/breadcrumbs.ts`.
- `/sales` hub page follows the `/masters` hub's card-grid convention exactly (lucide
  `FileText` icon for Quotations).

---

# Security

Gated by the `sales` permission module (spec 11): `view` (list/detail), `create`,
`edit` (update while editable, Send), `delete` is **not implemented** (no permanent
deletion of any business document — Cancel is the only removal path, matching every other
master in this codebase), `approve` used by Accept/Reject (a customer-facing decision
recorded by a more senior role in some organizations — left to each company's own role
configuration, not hard-coded), `export` for future list export. Every read and write is
company-scoped through the caller-supplied company id from `getCurrentCompanyUser()`.

---

# Database

New enum `QuotationStatus`; new models `Quotation`, `QuotationItem`. One migration.
Back-relations on `Company`, `FinancialYear`, `Customer`, `Product`, `User`. No seeding.

---

# Code Standards

Strict TypeScript, no `any`, no GST/pricing arithmetic outside the two engines (grep-able
invariant, spec 30/33's own standard extended here), transactions for header+items writes,
vitest coverage for: line/document total computation via the two engines (a thin
composition test, since the arithmetic itself is already covered by specs 30/33's own
suites), status-transition matrix (valid/invalid transitions per state), numbering
uniqueness per company/FY, cross-company customer/product rejection, `validUntil` before
`quotationDate` rejection.

---

# Do Not

Do not implement

- Any Voucher, stock movement, or GST register entry (Sales Invoice, spec 38, is where
  a document first becomes financially consequential)
- Prospect quoting without a Customer master row
- Discount schemes, coupons, or promotional-pricing masters
- Printing, PDF generation, or WhatsApp sharing — project-overview.md lists these as
  Sales Management features, but they are cross-document concerns spanning all seven
  Phase 3 documents; building one ad-hoc print view here (and differently in each later
  spec) would fragment a concern that deserves one dedicated future feature-spec once all
  seven document types exist. Recorded identically in specs 36–41.
- Barcode scanning UX (`phase-tracker.md` #76)
- Sales Orders, Delivery Challans, or any later document (specs 36–41)
- A scheduled/background job to auto-expire quotations (no job infra exists; `EXPIRED` is
  a derived read-time label plus a hard-reject on late conversion attempts)

---

# Success Criteria

Verify

- A Quotation can be created for an active Permanent Customer with 1+ lines; line/document
  totals match `calculateLine`/`calculateDocument`'s output exactly for a hand-computed
  fixture (including a mixed-rate, mixed-cess case).
- `quotationNumber` is unique per company/financial year, generated by the Document Number
  Engine, never client-suppliable.
- The full status matrix behaves correctly: only documented transitions succeed; editing a
  terminal-state quotation is rejected; converting a `DRAFT`/`REJECTED`/`CANCELLED`
  quotation is rejected.
- A resolved-or-overridden below-cost rate surfaces `isBelowCost` without blocking save.
- Cross-company customer/product ids are rejected as not-found.
- `npx tsc --noEmit`, `npx eslint src prisma`, `npx vitest run`, and `next build` all pass;
  `/sales` and `/sales/quotations*` appear in the build route table.

Feature-spec 35 (this spec) is `context/Phases/phase-tracker.md`'s Phase 3 item #33.
Feature-spec 36 (Sales Orders, tracker #34) depends on it for the conversion flow.
