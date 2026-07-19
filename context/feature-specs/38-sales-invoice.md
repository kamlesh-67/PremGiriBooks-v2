# 38 - Sales Invoice

> Feature-spec file number 38. This feature is `context/Phases/phases.md`'s **Phase 3 —
> Sales Management** and `context/Phases/phase-tracker.md`'s Phase 3 item **#36 Sales
> Invoice** — the tracker's `Depends On` column lists **Voucher + Inventory + GST
> Engines** explicitly, unlike the three documents before it in this phase. This is the
> pivotal spec of Phase 3: the first Sales document with real financial and stock
> consequences, and the first consumer of all three Shared ERP Engines (specs 31–33)
> together. Fourth of the seven Phase 3 documents.

## Goal

Implement **Sales Invoice** for **Premgiri Books ERP** — the GST-compliant tax invoice
that turns a sale into accounting entries (Voucher Engine, spec 31), stock movement
(Inventory Engine, spec 32), and GST-correct line/document totals (GST Engine, spec 33),
atomically, in one transaction. This is the document `architecture-context.md`'s
"Voucher Generated" lifecycle step is named after, and the one Reports (#61–#69) and GST
returns (#71–#73) will eventually read through the Voucher/Stock-Transaction trails it
produces.

It also, per `26-customer-management.md`'s explicit forward-note, is where **Quick
Customer** (create-on-the-fly, optionally converted to Permanent) and **Walk-in
Customer** (no master at all) billing live — the two customer modes Customer Management
deliberately did not build.

This is the largest spec in Phase 3; specs 39–41 (Sales Return, Credit Note, Debit Note)
all reuse the ledger-mapping and posting conventions this spec establishes rather than
re-deriving them.

---

# Project Context

Before implementation, review

- `35-quotations.md`, `36-sales-orders.md`, `37-delivery-challans.md` (the header/line/
  engine-reuse conventions this spec extends; the optional `salesOrderId`/
  `deliveryChallanId` linkage this spec consumes)
- architecture-context.md (Voucher Driven, Document Driven, Customer Architecture — the
  three customer types), code-standards.md (Financial Rules, Inventory Rules, GST Rules,
  Pricing Rules — every rule this spec is the first document to actually enforce at
  posting time)
- `26-customer-management.md` (**read the Quick/Walk-in forward-notes carefully** —
  `customerService.createCustomer` is the method this spec calls to convert a Quick
  Customer, not a duplicate)
- `31-voucher-engine.md` (`postVoucher(companyId, input, tx?)` — this spec is the first
  real caller; `VoucherType.SALES`; the balanced-entries contract)
- `32-inventory-engine.md` (`recordMovements(companyId, lines, tx?)` —
  `StockTransactionType.SALES`, direction `OUT`; `hasSufficientStock`/
  `allowNegativeStock`)
- `33-gst-engine.md` (`calculateLine`/`calculateDocument`/`determineSupplyType`/
  `isHsnRequired` — the same functions specs 35–37 used for display now feed real
  posting; **the forward-note "a document that overrides computed tax stores both
  computed and overridden values and its own audit trail; forward-noted for spec 36/42"
  is *this* spec** — implement it)
- `34-document-number-engine.md` (`DocumentType.SALES_INVOICE`)
- `13-ledger-groups.md` (reserved "Sales Accounts" and "Duties & Taxes" groups — this
  spec's new Company Settings ledger mapping points into them)
- `15-bank-management.md` (`BankAccount`-linked Ledgers — this spec's payment lines
  reference these directly, no new mapping needed)

---

# Module Responsibilities

The Sales Invoice module is responsible for

- Sales Invoice Master (Create/Post/View/Cancel, scoped to the active company and
  financial year) — **no Edit after posting** (Financial Rules: posted documents are
  immutable)
- Orchestrating, in one transaction at posting time: GST calculation (GST Engine),
  balanced voucher posting (Voucher Engine), and stock-out (Inventory Engine) — the one
  place in this phase all three engines are called together
- Quick Customer capture and optional on-the-fly conversion to a Permanent Customer
  (calling `customerService.createCustomer`, spec 26)
- Walk-in (cash, no master) billing
- Split/multiple payment methods per invoice
- Tax override with audit trail (the spec-33 forward-note)
- Sales Invoice numbering via the Document Number Engine (`DocumentType.SALES_INVOICE`)
- A new Company Settings section: the Sales/GST ledger mapping every posting depends on

The Sales Invoice module is **not** responsible for

- Sales Return, Credit Note, or Debit Note (specs 39–41 — this spec's posted invoices are
  what those three reference)
- Credit-limit **enforcement** — reads `Customer.creditLimit`, surfaces it as a non-
  blocking warning only, per spec 26's explicit deferral ("nothing enforces it today")
- Barcode scanning UX (`phase-tracker.md` #76) or the dedicated fast Billing Screen
  (`ui-context.md`'s Billing Screen is a future performance-optimized surface; this spec
  ships a correct, standard document-entry form, not that keyboard-first screen)
- Printing, PDF generation, or WhatsApp sharing (deferred identically to specs 35–37 —
  see Do Not for the one exception, browser print, this spec does add)
- E-Invoice / E-Way Bill generation (project-overview.md Out of Scope)

---

# Data Model

Add to `prisma/schema.prisma` (plus `salesInvoices SalesInvoice[]` back-relations on
`Company`, `FinancialYear`, `Customer`, `User`; `Voucher.referenceType = "SALES_INVOICE"`/
`referenceId` links back per spec 31's polymorphic convention):

```text
enum SalesInvoiceStatus {
  DRAFT
  POSTED
  CANCELLED
}

enum CustomerMode {
  PERMANENT
  QUICK
  WALK_IN
}

model SalesInvoice {
  id                     String             @id @default(uuid())
  companyId              String
  company                Company            @relation(fields: [companyId], references: [id])
  financialYearId        String
  financialYear          FinancialYear      @relation(fields: [financialYearId], references: [id])
  invoiceNumber          String
  invoiceDate            DateTime           @db.Date
  customerMode           CustomerMode
  customerId             String?
  customer               Customer?          @relation(fields: [customerId], references: [id])
  quickCustomerName      String?
  quickCustomerMobile    String?
  quickCustomerGstin     String?
  quickCustomerAddress   String?
  placeOfSupplyStateCode String
  salesOrderId           String?
  salesOrder             SalesOrder?        @relation(fields: [salesOrderId], references: [id])
  deliveryChallanId      String?            @unique
  deliveryChallan        DeliveryChallan?   @relation(fields: [deliveryChallanId], references: [id])
  status                 SalesInvoiceStatus @default(DRAFT)
  narration              String?
  subtotal               Decimal            @db.Decimal(14, 2)
  totalDiscount           Decimal           @db.Decimal(14, 2)
  taxableAmount           Decimal           @db.Decimal(14, 2)
  totalCgst               Decimal           @db.Decimal(14, 2)
  totalSgst               Decimal           @db.Decimal(14, 2)
  totalIgst               Decimal           @db.Decimal(14, 2)
  totalCess               Decimal           @db.Decimal(14, 2)
  roundOff                Decimal           @db.Decimal(14, 2) @default(0)
  grandTotal              Decimal           @db.Decimal(14, 2)
  amountPaid              Decimal           @db.Decimal(14, 2) @default(0)
  voucherId              String?            @unique
  voucher                Voucher?           @relation(fields: [voucherId], references: [id])
  createdByUserId        String?
  createdBy              User?              @relation(fields: [createdByUserId], references: [id])
  createdAt              DateTime           @default(now())
  updatedAt              DateTime           @updatedAt

  items    SalesInvoiceItem[]
  payments SalesInvoicePayment[]

  @@unique([companyId, financialYearId, invoiceNumber])
  @@index([companyId, customerId])
  @@index([companyId, status])
  @@index([salesOrderId])
}

model SalesInvoiceItem {
  id                String       @id @default(uuid())
  salesInvoiceId    String
  salesInvoice      SalesInvoice @relation(fields: [salesInvoiceId], references: [id])
  lineNumber        Int
  productId         String
  product           Product      @relation(fields: [productId], references: [id])
  warehouseId       String
  warehouse         Warehouse    @relation(fields: [warehouseId], references: [id])
  quantity          Decimal      @db.Decimal(14, 4)
  rate              Decimal      @db.Decimal(14, 2)
  discountPercent   Decimal      @db.Decimal(5, 2) @default(0)
  discountAmount    Decimal      @db.Decimal(14, 2) @default(0)
  ratePercent       Decimal      @db.Decimal(5, 2)
  cessPercent       Decimal      @db.Decimal(5, 2) @default(0)
  taxableAmount     Decimal      @db.Decimal(14, 2)
  cgst              Decimal      @db.Decimal(14, 2)
  sgst              Decimal      @db.Decimal(14, 2)
  igst              Decimal      @db.Decimal(14, 2)
  cess              Decimal      @db.Decimal(14, 2)
  totalAmount       Decimal      @db.Decimal(14, 2)
  isTaxOverridden   Boolean      @default(false)
  overriddenCgst    Decimal?     @db.Decimal(14, 2)
  overriddenSgst    Decimal?     @db.Decimal(14, 2)
  overriddenIgst    Decimal?     @db.Decimal(14, 2)
  overriddenCess    Decimal?     @db.Decimal(14, 2)
  overrideReason    String?
  overriddenByUserId String?
  overriddenBy      User?        @relation(fields: [overriddenByUserId], references: [id])

  @@unique([salesInvoiceId, lineNumber])
  @@index([productId])
  @@index([warehouseId])
}

model SalesInvoicePayment {
  id             String       @id @default(uuid())
  salesInvoiceId String
  salesInvoice   SalesInvoice @relation(fields: [salesInvoiceId], references: [id])
  ledgerId       String
  ledger         Ledger       @relation(fields: [ledgerId], references: [id])
  amount         Decimal      @db.Decimal(14, 2)
  reference      String?

  @@index([salesInvoiceId])
  @@index([ledgerId])
}

// Add to existing model CompanySettings (alongside spec 32's allowNegativeStock):
salesLedgerId      String?
salesLedger        Ledger?  @relation("CompanySettingsSalesLedger", fields: [salesLedgerId], references: [id])
outputCgstLedgerId String?
outputCgstLedger   Ledger?  @relation("CompanySettingsOutputCgst", fields: [outputCgstLedgerId], references: [id])
outputSgstLedgerId String?
outputSgstLedger   Ledger?  @relation("CompanySettingsOutputSgst", fields: [outputSgstLedgerId], references: [id])
outputIgstLedgerId String?
outputIgstLedger   Ledger?  @relation("CompanySettingsOutputIgst", fields: [outputIgstLedgerId], references: [id])
outputCessLedgerId String?
outputCessLedger   Ledger?  @relation("CompanySettingsOutputCess", fields: [outputCessLedgerId], references: [id])
roundOffLedgerId   String?
roundOffLedger     Ledger?  @relation("CompanySettingsRoundOff", fields: [roundOffLedgerId], references: [id])
```

Decisions

- **Why a new Company Settings ledger mapping, not auto-detection.** No prior spec seeds
  or names a specific "the" Sales Account / Output CGST / Output SGST / Output IGST /
  Output Cess / Round Off ledger — only the reserved *groups* exist (`13-ledger-
  groups.md`). Auto-picking "the one ledger under Duties & Taxes" would be fragile (a
  company could have several) and silently magical (violates the "explicit over clever"
  posture this codebase has followed since `document-number-engine.md`'s prefix map).
  Instead, this spec adds six optional nullable FK columns to `CompanySettings` (the same
  table spec 32 already extended with `allowNegativeStock`) and a small settings-form
  section to configure them once. **Posting a Sales Invoice requires all six to be
  configured** — attempting to post with any missing rejects with a friendly error naming
  which mapping is absent and pointing at Settings. Draft invoices may exist and be
  edited without any mapping configured (only posting is gated).
  - `outputIgstLedgerId`/`outputCessLedgerId` are still required even for a company that
    only ever trades intra-state, for the same "explicit, not clever" reason — an unused
    mapping simply never gets an entry (no zero-amount lines are ever posted, per Voucher
    Engine's amount-must-be->0 rule).
- **Cash/Bank payment ledgers need no new mapping** — `SalesInvoicePayment.ledgerId`
  references any active company Ledger directly (typically the seeded "Cash-in-Hand"
  ledger from spec 14, or a `BankAccount`-linked Ledger from spec 15), chosen explicitly
  per payment line, exactly like every other transaction in this codebase picks its own
  ledgers.
- **`customerMode` discriminator**: `PERMANENT` requires `customerId`; `QUICK` requires
  `quickCustomerName` (mobile/GSTIN/address optional) and forbids `customerId`;
  `WALK_IN` forbids both `customerId` and every `quickCustomer*` field except an optional
  `quickCustomerName` for the printed receipt's "Customer Name" line only (no persistence
  intent beyond display — see Business Rules for the payment-in-full rule this mode
  carries).
- **`isTaxOverridden` + `overridden*` columns** — the spec-33 forward-note, implemented
  literally: `cgst`/`sgst`/`igst`/`cess` always hold the **system-computed** values (GST
  Engine's `calculateLine` output, never overwritten); `overridden*` holds the **used**
  values only when a line's tax was manually adjusted, alongside `overrideReason`
  (required, non-empty, when `isTaxOverridden` is true) and `overriddenByUserId`. The
  voucher posts using the overridden values when present, computed values otherwise —
  both remain readable on the row forever (the audit trail).
- **`roundOff`** — the difference between `calculateDocument`'s exact sum
  (taxable + cgst + sgst + igst + cess, after any line-level overrides are substituted
  in) and the invoice's rupee-rounded `grandTotal`; may be positive or negative. Posted to
  `CompanySettings.roundOffLedgerId` only when non-zero (Voucher Engine rejects zero-
  amount entries).
- **`voucherId`** — `@unique`, the posted Sales Invoice's own `Voucher` (`VoucherType.
  SALES`). `Voucher.referenceType`/`referenceId` (spec 31) also point back
  (`"SALES_INVOICE"`, this row's id) — belt-and-suspenders: the FK is the fast, typed
  lookup; the polymorphic pair is the generic one Reports/other engines already know how
  to query.
- No `branchId` (same forward-noted posture as every spec in this phase and Phase 2).

---

# Business Rules

## Creation and editing (`DRAFT` only)

- Same line calculation as specs 35–37 (`resolvePrice` prefill, always overridable;
  `calculateLine`/`calculateDocument` for computed values), plus:
  - **Below-cost gate is now enforced, not advisory.** A line whose final rate resolves
    `isBelowCost: true` may be **saved** as `DRAFT` freely (so a cashier isn't blocked
    mid-entry), but **posting** an invoice containing any below-cost line requires the
    posting user to additionally hold the `sales` module's `approve` action (not just
    `create`) — code-standards.md: "Selling below cost requires warning or approval,"
    operationalized here as the existing `approve` action rather than inventing a new
    permission action.
  - **HSN is now a hard block at posting**, not a warning: `isHsnRequired` failing for
    any taxed line rejects posting with a friendly, line-specific error (code-
    standards.md: "HSN Code is mandatory where applicable").
- **Quick Customer conversion**: an explicit "Save as Permanent Customer" checkbox, or an
  automatic conversion when posting would leave an unpaid balance (see Payment) for a
  `QUICK` invoice. This conversion happens **inside the same posting transaction** as the
  rest of `postSalesInvoice` (the first sub-step of Posting below), not in a separate
  transaction before it opens — `customerService.createCustomer` (spec 26) gains an
  optional `tx?` parameter for this one caller (the same `tx?` convention every engine and
  cross-module call in this project already follows), so the new Customer/Ledger commits
  or rolls back atomically with the GST/stock/voucher work that follows it: if any later
  step in this same transaction fails, the just-created Customer/Ledger rolls back too,
  leaving no orphan record. `customerId` is set and `customerMode` switched to
  `PERMANENT` on this invoice as part of that same transaction, before the voucher that
  debits the new ledger is built. If `customerId` is already set when posting is retried
  (a prior attempt already converted and committed successfully before failing on a later
  step), the conversion is skipped — it does not re-run and does not create a second
  Customer for the same invoice.
- **`salesOrderId`/`deliveryChallanId`** — optional, mutually compatible (an invoice may
  reference both, one, or neither). When `deliveryChallanId` is set, its status must be
  `DISPATCHED` and not already linked to another invoice (`@unique` enforces the second
  half at the database level). One Delivery Challan → at most one Sales Invoice in this
  phase (see `37-delivery-challans.md`'s Do Not on consolidated billing) — a business
  needing to invoice several challans together raises separate invoices; this is a
  documented, deliberate simplification, not an oversight. Full customer/company/order
  identity agreement and exact line/quantity matching between the invoice and its linked
  challan are re-verified at posting time (see Posting, step 2), not just the status
  check above.

## Posting (`postSalesInvoice`, one transaction)

Order of operations, all inside a single Serializable transaction (the Inventory Engine's
own OUT-batch convention, spec 32, since this posting always contains OUT stock lines):

1. Re-validate every business rule above against the **current** state (not the state
   when the draft was last saved) — active customer/product/warehouse, FY still open,
   HSN present, below-cost permission if applicable, all six ledger mappings configured.
   If a Quick Customer conversion applies (see above), run it here, first, inside this
   same transaction.
2. **Delivery Challan identity/line consistency** (only when `deliveryChallanId` is set):
   the challan's `customerId` must equal this invoice's own customer (resolved from
   `customerId` for `PERMANENT`/converted-`QUICK` — a challan can only ever have a
   `PERMANENT` customer, per spec 37, so a `WALK_IN` invoice cannot reference one), and
   its `companyId` must match (a belt-and-suspenders guard on a cross-document reference,
   redundant with normal company-scoping but checked explicitly here). If both
   `salesOrderId` and the challan's own `salesOrderId` are present, they must agree — an
   invoice cannot claim a different order than the very challan it is invoicing. The
   challan's own status must still be `DISPATCHED` and unclaimed by another invoice.
   **Every invoice line's `productId` and `quantity` must match one of the challan's own
   lines exactly** (one invoice line per challan line, quantity equal — splitting or
   partially invoicing a challan line is not allowed in this phase). Any mismatch rejects
   posting with a friendly, line-specific error, before any stock or voucher entry is
   created.
3. Recompute `calculateDocument` from the current lines (never trust stored draft totals
   at posting time — they may be stale if a referenced product/rate changed since save).
4. **Validate payments against this just-recomputed total, not the stale draft total**:
   `Σ payments ≤ grandTotal` for every customer mode, and `Σ payments === grandTotal`
   exactly for `WALK_IN` — both checked here, against this step's freshly-recomputed
   `grandTotal`, before any engine call; a payment total checked only against a
   since-changed draft total (or only checked for individual positivity) would silently
   let an overpayment or an underpaid `WALK_IN` sale through.
5. Generate `invoiceNumber` (`ensureSequence` before the transaction, `generateNumber`
   inside it — spec 34's contract).
6. Call `inventoryEngine.recordMovements(companyId, lines, tx)` — one
   `StockTransactionType.SALES`/`OUT` line per invoice line, `referenceType =
   "SALES_INVOICE"`.
7. Build the balanced voucher entry set (see Ledger Posting below) and call
   `voucherEngine.postVoucher(companyId, input, tx)` (`VoucherType.SALES`).
8. If `deliveryChallanId` is set, call `deliveryChallanService.markInvoiced(id, tx)`
   (spec 37) — safe now that step 2 has already confirmed the identity/line match.
9. If `salesOrderId` is set and no `deliveryChallanId` linkage already advanced it, this
   spec does **not** call `SalesOrder.applyDelivery` itself — fulfillment tracking is
   Delivery Challan's exclusive responsibility (spec 36's Business Rules); a direct
   Order→Invoice flow with no challan in between leaves the order's `deliveredQuantity`
   at 0, a documented gap for a business that skips Delivery Challans entirely (Do Not).
10. Set `status = POSTED`, `voucherId`.

## Ledger Posting (the balanced entry set `postVoucher` receives)

- **Credit side**: `CompanySettings.salesLedgerId` for the document's `taxableAmount`;
  `outputCgstLedgerId`/`outputSgstLedgerId` (intra-state) or `outputIgstLedgerId`
  (inter-state) for their respective totals (using overridden values where
  `isTaxOverridden`); `outputCessLedgerId` for `totalCess` when non-zero. Each only
  posted when its amount is non-zero (Voucher Engine's amount->0 rule).
- **Debit side**: each `SalesInvoicePayment` row debits its own `ledgerId` for its
  `amount`; any remainder (`grandTotal − Σ payments`) debits the customer's Ledger
  (`PERMANENT` or a just-converted `QUICK` customer) — **a remainder is not permitted for
  `WALK_IN`** (no ledger exists to carry it; see below).
- **Round off**: `roundOff` posts as one additional entry to `CompanySettings.
  roundOffLedgerId` — `DEBIT` when `roundOff` is negative (grand total rounded down),
  `CREDIT` when positive (rounded up), using its absolute value; skipped entirely when
  zero.
- **Balance holds by construction**: Σ debits (payments + customer remainder) ≡
  `grandTotal` ≡ Σ credits (sales + tax + round-off), so `postVoucher`'s balanced-sum
  check always passes for correctly-computed input — any mismatch indicates a bug in this
  spec's own aggregation, not a data problem to work around.
- **`WALK_IN` must be paid in full**: `Σ payments === grandTotal` exactly — checked in
  Posting step 4, inside the transaction, against the freshly recomputed `grandTotal`
  (never a stale draft total) — rejected otherwise with a friendly "walk-in sales require
  full payment" error (no ledger exists to carry a walk-in balance). Every other customer
  mode is capped at `Σ payments ≤ grandTotal` in that same step — an overpayment is
  rejected, never silently posted as a negative customer balance.
- **Credit-limit check is advisory only** (spec 26's deferral): if posting would leave a
  `PERMANENT` customer's outstanding balance over their stored `creditLimit`, the UI shows
  a non-blocking confirmation; the server does not reject on this basis.

## Cancellation

- `cancelSalesInvoice(id)`: only a `POSTED`, not-yet-referenced-by-a-Return/Credit-Note/
  Debit-Note invoice (specs 39–41 check back against this one; this spec itself does not
  need to know about them yet — the rejection lives in those specs' own posting checks
  against a cancelled invoice's status). Calls `voucherEngine.cancelVoucher` (mirrored
  reversal) and `inventoryEngine.recordMovements` with the same lines reversed
  direction (`IN`, same `StockTransactionType.SALES` semantics reversed via direction —
  **not** `SALES_RETURN`, since this is undoing a mistaken posting, not a customer
  return) — both inside one transaction. Sets `status = CANCELLED`. If a linked Delivery
  Challan was marked `INVOICED`, it is **not** reverted to `DISPATCHED` automatically
  (a documented gap — manual correction, since un-cancelling a challan's own status
  crosses a module boundary this spec does not own; recorded as a forward-note for
  whichever future spec needs it).

---

# Service / Repository

Create

```text
src/modules/sales-invoices/repositories/sales-invoice-repository.ts
src/modules/sales-invoices/services/sales-invoice-service.ts
src/modules/sales-invoices/validation/sales-invoice-schema.ts
src/modules/sales-invoices/actions/sales-invoice-actions.ts
src/modules/sales-invoices/components/…
src/types/sales-invoice.ts
src/modules/company-settings/…  // extend existing (spec 6/32) with the ledger-mapping form section
```

- `salesInvoiceService`: `listSalesInvoices(filters)`, `getSalesInvoice(id)`,
  `createDraft(input)`, `updateDraft(id, input)`, `postSalesInvoice(id)` (the
  orchestration above), `cancelSalesInvoice(id)`, `createFromDeliveryChallan
  (deliveryChallanId)` (pre-fills lines/warehouses from the challan).
- All three engine calls (`voucherEngine.postVoucher`, `inventoryEngine.recordMovements`,
  `gstEngine.calculateDocument`) happen inside `sales-invoice-service.ts`'s
  `postSalesInvoice`, never inside a Server Action or component (Engine Driven
  principle). Repository → Service layering for everything else.

---

# Validation

Zod (`sales-invoice-schema.ts`): `customerMode` enum with the mutual-exclusivity refine
described above, `placeOfSupplyStateCode` against `GST_STATE_CODES`, `invoiceDate`
calendar date, `narration` ≤ 500, lines array ≥ 1 (`productId`/`warehouseId` uuid,
`quantity` > 0 with unit precision, `rate` ≥ 0 ≤ 2 decimals, discount fields as specs
35–37, `overrideReason` required non-empty ≤ 500 when a line's override flag is set),
payments array (`ledgerId` uuid, `amount` > 0 ≤ 2 decimals).

---

# UI

Pages (under the `/sales` hub)

- `/sales/invoices` — Sales Invoice list (Number, Customer/Quick name/"Walk-in", Date,
  Status, Grand Total, Paid, Actions) with search + status/customer/date filters
- `/sales/invoices/new` — Create Sales Invoice (customer-mode toggle at the top;
  optionally prefilled from a Delivery Challan's "Create Invoice" action)
- `/sales/invoices/[id]` — View Sales Invoice (read-only detail once posted, tax
  breakdown, payment breakdown, status actions: Post / Cancel; a browser **Print**
  action using `ui-context.md`'s A4/A5 print-stylesheet convention — the one exception to
  the deferred-printing posture of specs 35–37, since a tax invoice is the one document
  in this phase a business must legally hand to the customer; no PDF library, no
  WhatsApp — see Do Not)
- `/sales/invoices/[id]/edit` — Edit Sales Invoice (only reachable while `DRAFT`)
- Extend the existing Company Settings page with a new "Sales & GST Ledgers" section
  (six Ledger Selector fields — Sales Account, Output CGST, Output SGST, Output IGST,
  Output Cess, Round Off), gated by the existing `settings`/`edit` permission (spec 34's
  precedent).

Components (`src/modules/sales-invoices/components/`): Sales Invoice Table (+ filter
bar), Sales Invoice Form (customer-mode section, line editor with a per-line "Override
Tax" toggle exposing the reason field, payment-lines editor with a running "Amount Due"
display), Tax Override Dialog, Payment Split Editor, Sales Invoice Status Badge, Print
View (a plain print-stylesheet layout, not a PDF).

Wire-up

- Add a "Sales Invoices" card to the `/sales` hub page.
- Add `invoices: "Sales Invoices"` to `src/constants/breadcrumbs.ts`.

---

# Security

Gated by the `sales` permission module: `view`, `create` (draft + post, when no
below-cost line exists), `approve` (required **in addition to** `create` to post an
invoice containing any below-cost line — see Business Rules), `edit` (update while
`DRAFT`), `delete` not implemented (`cancelSalesInvoice`, `POSTED`-only, is the removal
path), `export`. Company-scoped identically to specs 35–37. The new Company Settings
ledger-mapping section is gated by the existing `settings`/`edit` permission, not `sales`.

---

# Database

New enums `SalesInvoiceStatus`, `CustomerMode`; new models `SalesInvoice`,
`SalesInvoiceItem`, `SalesInvoicePayment`; six new nullable FK columns on
`CompanySettings`. One migration. Back-relations on `Company`, `FinancialYear`,
`Customer`, `Product`, `Warehouse`, `SalesOrder`, `DeliveryChallan`, `Voucher`, `Ledger`,
`User`. No seeding (the ledger mapping is configured per-company via the Settings UI,
mirroring every other optional Company Settings field).

---

# Code Standards

Strict TypeScript, no `any`, no GST/pricing/stock/ledger arithmetic outside its owning
engine (the phase's grep-able invariant, now spanning all three engines in one
orchestrator), Serializable transaction with bounded retry for posting (the Inventory
Engine OUT-batch convention), vitest coverage for:

- the full posting orchestration (mocked engine calls) — correct call order, correct
  entry balancing across every customer mode × payment-split combination, including the
  round-off sign in both directions
- `WALK_IN` full-payment rejection (exact match) and overpayment rejection for every
  other mode (`Σ payments > grandTotal`), both validated against the freshly recomputed
  total inside the transaction, not a stale draft total; `QUICK` auto-conversion
  (including the retry-skips-reconversion case) and credit-limit advisory (non-blocking)
  behavior
- Delivery Challan identity/line-consistency rejection matrix (customer mismatch, company
  mismatch, disagreeing `salesOrderId`, product/quantity mismatch)
- below-cost approve-gate matrix (with/without the extra permission)
- HSN hard-block matrix
- tax-override audit trail (computed values preserved alongside overridden values)
- cancellation's mirrored reversal (voucher + stock) and the "already referenced by a
  return/note" rejection hook point (a stub the specs 39–41 tests will exercise fully)
- missing-ledger-mapping rejection, one case per one-of-six-missing

---

# Do Not

Do not implement

- Sales Return, Credit Note, or Debit Note (specs 39–41)
- Credit-limit **enforcement** (advisory only, per spec 26's explicit deferral)
- PDF generation or WhatsApp sharing (browser print only, per UI above)
- E-Invoice / E-Way Bill generation
- Consolidated multi-challan or multi-order invoicing
- Auto-reverting a linked Delivery Challan's status on invoice cancellation (documented
  gap, forward-noted)
- Auto-advancing a linked Sales Order's `deliveredQuantity` directly (Delivery Challan's
  exclusive responsibility, per spec 36)
- The dedicated keyboard-first Billing Screen (`ui-context.md`) or barcode scanning
  (`phase-tracker.md` #76) — both later, separate work

---

# Success Criteria

Verify

- Posting a `PERMANENT`-customer credit invoice produces a balanced `VoucherType.SALES`
  voucher and a matching `StockTransactionType.SALES`/`OUT` stock transaction per line,
  atomically (both succeed or both roll back on an injected failure).
- A `WALK_IN` invoice with full payment posts correctly with no customer-ledger entry; an
  underpaid `WALK_IN` attempt is rejected before any write; an overpayment is rejected for
  every customer mode, validated against the freshly recomputed `grandTotal` inside the
  posting transaction, not a stale draft total.
- A `QUICK` invoice left with an unpaid balance auto-converts to a real `Customer`+
  `Ledger` via `customerService.createCustomer` **inside the posting transaction**, and
  the voucher debits that new ledger; if a later step in that same transaction fails, the
  new Customer/Ledger rolls back with it (no orphan record); a retry with `customerId`
  already set does not create a second Customer.
- A Sales Invoice linked to a Delivery Challan is rejected before posting if the
  challan's customer, company, or linked sales order disagrees with the invoice's own, or
  if any invoice line's product/quantity doesn't match the challan's lines exactly.
- A below-cost line blocks posting for a user without `approve`, succeeds for one with
  it; a taxed line with no HSN blocks posting unconditionally.
- A tax override stores both the computed and overridden values, uses the overridden
  values in the posted voucher, and requires a non-empty reason.
- Cancelling a posted invoice produces a correct mirrored voucher reversal and a
  matching reversed stock transaction.
- Missing any one of the six Company Settings ledger mappings blocks posting with a
  specific, friendly error naming that mapping.
- `npx tsc --noEmit`, `npx eslint src prisma`, `npx vitest run`, and `next build` all
  pass; `/sales/invoices*` and the extended Settings route appear in the build route
  table.

Feature-spec 38 (this spec) is `context/Phases/phase-tracker.md`'s Phase 3 item #36.
Feature-specs 39–41 (Sales Return, Credit Note, Debit Note) all depend on it and reuse
its Company Settings ledger mapping without adding their own.
