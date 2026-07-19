# 44 - Purchase Invoice

> Feature-spec file number 44. This feature is `context/Phases/phases.md`'s **Phase 4 —
> Purchase Management** and `context/Phases/phase-tracker.md`'s Phase 4 item **#42
> Purchase Invoice** — the tracker's `Depends On` column lists **Voucher + Inventory +
> GST Engines** explicitly, the same as Sales Invoice's row. This is the pivotal spec of
> Phase 4: the first Purchase document with real financial and stock consequences.
> `33-gst-engine.md`'s tax-override-with-audit-trail forward-note names this spec
> directly ("forward-noted for spec 36/42" — 42 is this document's tracker number).
> Third of Phase 4's four documents; read `38-sales-invoice.md` first in full — this
> spec mirrors its posting orchestration almost exactly, with debit/credit reversed and
> no Quick/Walk-in supplier concept.

## Goal

Implement **Purchase Invoice** for **Premgiri Books ERP** — the document that records a
supplier's bill: accounting entries (Voucher Engine, spec 31, `VoucherType.PURCHASE`),
stock movement (Inventory Engine, spec 32, `StockTransactionType.PURCHASE`/`IN`), and
GST-correct line/document totals including **input tax credit** (GST Engine, spec 33),
atomically, in one transaction — the purchase-side mirror of `38-sales-invoice.md`.

Unlike Sales Invoice, there is no Quick/Walk-in supplier concept: every Purchase Invoice
references an existing, active Supplier (feature-spec 27) — suppliers are always
established business relationships in this codebase, never created on-the-fly at billing
time. This removes an entire dimension of complexity Sales Invoice had to solve.

---

# Project Context

Before implementation, review

- `38-sales-invoice.md` (**read this first in full** — the posting orchestration,
  Company Settings ledger-mapping pattern, tax-override-with-audit-trail implementation,
  and round-off handling this spec mirrors with debit/credit reversed; differences are
  called out explicitly below and not re-derived)
- `42-purchase-orders.md`, `43-goods-receipt-note.md` (the optional `purchaseOrderId`/
  `goodsReceiptNoteId` linkage this spec consumes, mirroring Sales Invoice's
  `salesOrderId`/`deliveryChallanId`)
- `27-supplier-management.md` (`Supplier`/`Ledger` shape — no on-the-fly creation path
  needed here, unlike Customer's Quick-Customer flow)
- `31-voucher-engine.md` (`VoucherType.PURCHASE`), `32-inventory-engine.md`
  (`StockTransactionType.PURCHASE`/`IN`, `hasSufficientStock` is not relevant here —
  purchases only ever add stock), `33-gst-engine.md` (`calculateLine`/
  `calculateDocument`/`isHsnRequired`, the tax-override forward-note), `34-document-
  number-engine.md` (`DocumentType.PURCHASE_INVOICE`)
- `13-ledger-groups.md` (reserved "Purchase Accounts" and "Duties & Taxes" groups — this
  spec's new Company Settings ledger mapping points into them, alongside spec 38's
  existing sales-side mapping)

---

# Module Responsibilities

The Purchase Invoice module is responsible for

- Purchase Invoice Master (Create/Post/View/Cancel, scoped to the active company and
  financial year) — **no Edit after posting**
- Orchestrating, in one transaction at posting time: GST calculation, balanced voucher
  posting, and stock-in — the purchase-side mirror of Sales Invoice's three-engine
  orchestration
- Split/multiple payment methods per invoice (paying the supplier immediately, in full
  or in part, at billing time — mirrors Sales Invoice's payment-lines design)
- Tax override with audit trail (the spec-33 forward-note, implemented identically to
  spec 38)
- Purchase Invoice numbering via the Document Number Engine
  (`DocumentType.PURCHASE_INVOICE`)
- A new Company Settings section: the Purchase/Input-GST ledger mapping every posting
  depends on (alongside spec 38's Sales/Output-GST mapping, on the same `CompanySettings`
  row)

The Purchase Invoice module is **not** responsible for

- Purchase Return (feature-spec 45 — this spec's posted invoices are what that
  references)
- Credit-terms **enforcement** — reads `Supplier.creditDays` for display only (spec 27
  never asked for enforcement; consistent with Sales Invoice's identical deferral for
  `Customer.creditLimit`)
- Any on-the-fly Supplier creation (no Quick/Walk-in equivalent exists for purchases)
- Printing, PDF generation, or WhatsApp sharing (a supplier bill is not typically printed
  *by* the receiving business the way a sales invoice must leave it — no browser-print
  exception is carried over from spec 38; see Do Not)

---

# Data Model

Add to `prisma/schema.prisma` (plus `purchaseInvoices PurchaseInvoice[]` back-relations
on `Company`, `FinancialYear`, `Supplier`, `User`; `Voucher.referenceType =
"PURCHASE_INVOICE"`/`referenceId` per spec 31's polymorphic convention):

```text
enum PurchaseInvoiceStatus {
  DRAFT
  POSTED
  CANCELLED
}

model PurchaseInvoice {
  id                     String                @id @default(uuid())
  companyId              String
  company                Company               @relation(fields: [companyId], references: [id])
  financialYearId        String
  financialYear          FinancialYear         @relation(fields: [financialYearId], references: [id])
  invoiceNumber          String?               // this system's own document number — null until posted, see Decisions
  supplierInvoiceNumber  String                // the supplier's own bill number — see Decisions
  invoiceDate            DateTime              @db.Date
  supplierId             String
  supplier               Supplier              @relation(fields: [supplierId], references: [id])
  placeOfSupplyStateCode String
  purchaseOrderId        String?
  purchaseOrder          PurchaseOrder?        @relation(fields: [purchaseOrderId], references: [id])
  goodsReceiptNoteId     String?               @unique
  goodsReceiptNote       GoodsReceiptNote?     @relation(fields: [goodsReceiptNoteId], references: [id])
  status                 PurchaseInvoiceStatus @default(DRAFT)
  narration              String?
  subtotal               Decimal               @db.Decimal(14, 2)
  totalDiscount           Decimal              @db.Decimal(14, 2)
  taxableAmount           Decimal              @db.Decimal(14, 2)
  totalCgst               Decimal              @db.Decimal(14, 2)
  totalSgst               Decimal              @db.Decimal(14, 2)
  totalIgst               Decimal              @db.Decimal(14, 2)
  totalCess               Decimal              @db.Decimal(14, 2)
  roundOff                Decimal              @db.Decimal(14, 2) @default(0)
  grandTotal              Decimal              @db.Decimal(14, 2)
  amountPaid              Decimal              @db.Decimal(14, 2) @default(0)
  voucherId              String?               @unique
  voucher                Voucher?              @relation(fields: [voucherId], references: [id])
  createdByUserId        String?
  createdBy              User?                 @relation(fields: [createdByUserId], references: [id])
  createdAt              DateTime              @default(now())
  updatedAt              DateTime              @updatedAt

  items    PurchaseInvoiceItem[]
  payments PurchaseInvoicePayment[]

  @@unique([companyId, financialYearId, invoiceNumber])
  @@unique([companyId, supplierId, supplierInvoiceNumber])
  @@index([companyId, status])
  @@index([purchaseOrderId])
}

model PurchaseInvoiceItem {
  id                 String          @id @default(uuid())
  purchaseInvoiceId  String
  purchaseInvoice    PurchaseInvoice @relation(fields: [purchaseInvoiceId], references: [id])
  lineNumber         Int
  productId          String
  product            Product         @relation(fields: [productId], references: [id])
  warehouseId        String
  warehouse          Warehouse       @relation(fields: [warehouseId], references: [id])
  quantity           Decimal         @db.Decimal(14, 4)
  rate               Decimal         @db.Decimal(14, 2)
  discountPercent    Decimal         @db.Decimal(5, 2) @default(0)
  discountAmount     Decimal         @db.Decimal(14, 2) @default(0)
  ratePercent        Decimal         @db.Decimal(5, 2)
  cessPercent        Decimal         @db.Decimal(5, 2) @default(0)
  taxableAmount      Decimal         @db.Decimal(14, 2)
  cgst               Decimal         @db.Decimal(14, 2)
  sgst               Decimal         @db.Decimal(14, 2)
  igst               Decimal         @db.Decimal(14, 2)
  cess               Decimal         @db.Decimal(14, 2)
  totalAmount        Decimal         @db.Decimal(14, 2)
  isTaxOverridden    Boolean         @default(false)
  overriddenCgst     Decimal?        @db.Decimal(14, 2)
  overriddenSgst     Decimal?        @db.Decimal(14, 2)
  overriddenIgst     Decimal?        @db.Decimal(14, 2)
  overriddenCess     Decimal?        @db.Decimal(14, 2)
  overrideReason     String?
  overriddenByUserId String?
  overriddenBy       User?           @relation(fields: [overriddenByUserId], references: [id])

  @@unique([purchaseInvoiceId, lineNumber])
  @@index([productId])
  @@index([warehouseId])
}

model PurchaseInvoicePayment {
  id                String          @id @default(uuid())
  purchaseInvoiceId String
  purchaseInvoice   PurchaseInvoice @relation(fields: [purchaseInvoiceId], references: [id])
  ledgerId          String
  ledger            Ledger          @relation(fields: [ledgerId], references: [id])
  amount            Decimal         @db.Decimal(14, 2)
  reference         String?

  @@index([purchaseInvoiceId])
  @@index([ledgerId])
}

// Add to existing model CompanySettings (alongside spec 32's allowNegativeStock and
// spec 38's Sales/Output-GST mapping — reuses spec 38's roundOffLedgerId, no duplicate):
purchaseLedgerId  String?
purchaseLedger    Ledger?  @relation("CompanySettingsPurchaseLedger", fields: [purchaseLedgerId], references: [id])
inputCgstLedgerId String?
inputCgstLedger   Ledger?  @relation("CompanySettingsInputCgst", fields: [inputCgstLedgerId], references: [id])
inputSgstLedgerId String?
inputSgstLedger   Ledger?  @relation("CompanySettingsInputSgst", fields: [inputSgstLedgerId], references: [id])
inputIgstLedgerId String?
inputIgstLedger   Ledger?  @relation("CompanySettingsInputIgst", fields: [inputIgstLedgerId], references: [id])
inputCessLedgerId String?
inputCessLedger   Ledger?  @relation("CompanySettingsInputCess", fields: [inputCessLedgerId], references: [id])
```

Decisions (differences from `38-sales-invoice.md` — read that spec for everything not
called out here)

- **No `customerMode`-equivalent discriminator** — every Purchase Invoice has a required
  `supplierId`. Nothing mirrors Quick/Walk-in; suppliers are always Permanent (spec 27).
- **`supplierInvoiceNumber`** — the supplier's own bill/reference number, **required**
  and unique per `(company, supplier)` pair (prevents accidentally recording the same
  supplier bill twice — a real, common data-entry mistake this constraint catches at the
  database level). `invoiceNumber` remains this system's own internally-generated number
  (`DocumentType.PURCHASE_INVOICE`, same two-step contract as every document in this
  project) — the two numbers serve different purposes and are never confused.
- **Five new `CompanySettings` columns**, not six — `roundOffLedgerId` is **reused from
  `38-sales-invoice.md`** (one Round Off ledger serves both directions; a business does
  not need two separate round-off accounts). `purchaseLedgerId`/`inputCgstLedgerId`/
  `inputSgstLedgerId`/`inputIgstLedgerId`/`inputCessLedgerId` are new. Posting requires
  these five plus the shared `roundOffLedgerId` (six total checked, one shared with
  Sales Invoice) to be configured — same missing-mapping rejection style as spec 38.
- **`isTaxOverridden`/`overridden*`/`overrideReason`/`overriddenByUserId`** — identical
  shape and rule to `SalesInvoiceItem`'s (the spec-33 forward-note applies to both
  documents by name).
- **No below-cost gate** — that check is a selling-price concept (code-standards.md's
  Pricing Rules apply to what the business charges, not what it pays); not applicable
  here.
- **HSN hard block at posting** — identical rule to Sales Invoice (code-standards.md:
  "HSN Code is mandatory where applicable" applies to purchases too).
- **`invoiceNumber` is nullable, assigned only at posting** — a `DRAFT` Purchase Invoice
  has no committed identity yet (the Document Number Engine's `generateNumber` step runs
  inside `postPurchaseInvoice`'s own transaction, per spec 34's contract, not at
  `createDraft` time). The `@@unique([companyId, financialYearId, invoiceNumber])`
  constraint still holds correctly with multiple `DRAFT` rows coexisting, since Postgres
  unique indexes treat `NULL` values as distinct from one another — this is not a gap in
  the constraint, it is exactly why the column can stay nullable without risking a false
  collision. This avoids consuming a real, sequential invoice number for a draft that may
  be edited repeatedly or never posted at all; `supplierInvoiceNumber` (required, unique
  per supplier — see above), not `invoiceNumber`, is what identifies and looks up a
  row before it is posted.
- No `branchId`, same posture as every spec in this project.

---

# Business Rules

## Creation and editing (`DRAFT` only)

- Line entry: `rate` prefilled from `product.purchasePrice` (no Pricing Engine call —
  see `42-purchase-orders.md`'s identical decision), always overridable;
  `ratePercent`/`cessPercent` from the product's `GstRate`, always overridable via the
  tax-override mechanism (with required `overrideReason` when used).
- **`purchaseOrderId`/`goodsReceiptNoteId`** — optional, mutually compatible. When
  `goodsReceiptNoteId` is set, its status must be `RECEIVED` and not already linked to
  another invoice (`@unique` enforces this). One Goods Receipt Note → at most one
  Purchase Invoice, mirroring Sales Invoice's Delivery Challan simplification — a
  supplier bill covering several GRNs is invoiced separately per GRN in this phase
  (documented, deliberate).

## Posting (`postPurchaseInvoice`, one transaction)

Mirrors `38-sales-invoice.md`'s orchestration exactly, direction adjusted:

1. Re-validate every business rule against current state (active supplier/product/
   warehouse, FY open, HSN present, all six ledger mappings validated — see Ledger
   Mapping Validation below, linked GRN still `RECEIVED` and unclaimed). **When
   `goodsReceiptNoteId` is set, also verify identity/line consistency**: the GRN's
   `supplierId` must equal this invoice's own `supplierId`, its `companyId` must match,
   and if both `purchaseOrderId` and the GRN's own `purchaseOrderId` are present they
   must agree. **Line matching is on the `(productId, warehouseId, quantity)` triple, not
   `productId`/`quantity` alone** — a GRN can legitimately carry two lines for the same
   product received into different warehouses, or (more rarely) two identical-looking
   lines for the same product/warehouse/quantity; matching on `productId`/`quantity`
   alone could match either one ambiguously. Each invoice line is matched **1:1** against
   exactly one GRN line — the match is validated as a bijection (every GRN line consumed
   by at most one invoice line, every invoice line matching exactly one GRN line, the
   invoice's own line count equal to the GRN's), not a lookup that stops at the first
   candidate — so a GRN carrying duplicate `(productId, warehouseId, quantity)` lines
   still resolves deterministically. Any mismatch rejects posting with a friendly,
   line-specific error, before any stock or voucher entry is created.
2. Recompute `calculateDocument` from current lines (never trust stale draft totals).
3. **Validate payments against this just-recomputed total, not a stale draft total**:
   `Σ payments ≤ grandTotal` — an overpayment is rejected here, before any further step.
   Set `amountPaid = Σ payments` (never entered independently — always derived from the
   payment rows, the same "no independently-editable derived field" posture as every
   other computed total in this project); the supplier's remainder,
   `grandTotal − amountPaid`, is guaranteed non-negative by this check.
4. Generate `invoiceNumber` (`ensureSequence`/`generateNumber`, spec 34's contract) — the
   first time this row receives a real number (see Decisions).
5. `inventoryEngine.recordMovements(companyId, lines, tx)` —
   `StockTransactionType.PURCHASE`/`IN`, `referenceType = "PURCHASE_INVOICE"`.
6. Build the balanced voucher (see Ledger Posting) and call `voucherEngine.postVoucher`
   (`VoucherType.PURCHASE`).
7. If `goodsReceiptNoteId` is set, call `goodsReceiptNoteService.markInvoiced(id, tx)`.
8. Set `status = POSTED`, `voucherId`.

## Ledger Posting (the reversal of Sales Invoice's)

- **Debit side**: `CompanySettings.purchaseLedgerId` for `taxableAmount`;
  `inputCgstLedgerId`/`inputSgstLedgerId` (intra-state) or `inputIgstLedgerId`
  (inter-state) for their respective totals (using overridden values where
  `isTaxOverridden`); `inputCessLedgerId` for `totalCess` when non-zero. Each posted
  only when non-zero.
- **Credit side**: each `PurchaseInvoicePayment` row credits its own `ledgerId` —
  **restricted to an active, company-owned ledger that is either the seeded Cash-in-Hand
  ledger (spec 14) or carries a `BankAccount` detail row (spec 15)**; any other ledger
  (e.g., a Sales/Purchase Account or an expense ledger) is rejected server-side as an
  invalid settlement account, not left to the client's own restraint — same
  explicit-per-transaction-choice convention as Sales Invoice's payment lines, reversed
  direction since paying out is a credit to Cash/Bank; any remainder
  (`grandTotal − Σ payments`) credits the supplier's Ledger (Sundry Creditors).
- **Round off**: one entry to the shared `CompanySettings.roundOffLedgerId` — `CREDIT`
  when `roundOff` is negative, `DEBIT` when positive (the mirror of Sales Invoice's
  sign convention), skipped when zero.
- **Balance holds by construction**, identical reasoning to Sales Invoice.
- **No "walk-in must pay in full" equivalent** — every Purchase Invoice has a real
  Supplier Ledger to carry a remainder, unlike Sales Invoice's `WALK_IN` edge case.
- **Ledger Mapping Validation** (all six ledgers — the five new fields plus the shared
  `roundOffLedgerId`): posting checks each configured ledger id is not merely non-null but
  currently **active**, **owned by the current company**, and assigned to the **expected
  ledger group** for its role — `purchaseLedgerId` under "Purchase Accounts" (or a
  descendant), `inputCgstLedgerId`/`inputSgstLedgerId`/`inputIgstLedgerId`/
  `inputCessLedgerId` under "Duties & Taxes" (or a descendant), `roundOffLedgerId` any
  active company ledger (no fixed group, per spec 38's original decision, reused here).
  A mapping pointing at an inactive, cross-company, or wrong-group ledger is treated
  identically to a missing one — rejected with the same friendly, mapping-specific error
  naming which of the six failed — never silently posted against the wrong account.

## Cancellation

- `cancelPurchaseInvoice(id)`: only a `POSTED`, not-yet-referenced-by-a-Purchase-Return
  invoice. Calls `voucherEngine.cancelVoucher` and reverses the stock movement (`OUT`,
  undoing the earlier `IN`) atomically — mirrors Sales Invoice's cancellation exactly.
  A linked GRN's `INVOICED` status is **not** auto-reverted (same documented gap as
  spec 38's identical decision).

---

# Service / Repository

Create

```text
src/modules/purchase-invoices/repositories/purchase-invoice-repository.ts
src/modules/purchase-invoices/services/purchase-invoice-service.ts
src/modules/purchase-invoices/validation/purchase-invoice-schema.ts
src/modules/purchase-invoices/actions/purchase-invoice-actions.ts
src/modules/purchase-invoices/components/…
src/types/purchase-invoice.ts
// extend the existing company-settings module (spec 38) with the Purchase/Input-GST
// ledger-mapping form section, on the same page as the Sales/Output-GST section
```

- `purchaseInvoiceService`: `listPurchaseInvoices(filters)`, `getPurchaseInvoice(id)`,
  `createDraft(input)`, `updateDraft(id, input)`, `postPurchaseInvoice(id)` (the
  orchestration above), `cancelPurchaseInvoice(id)`, `createFromGoodsReceiptNote
  (goodsReceiptNoteId)` (pre-fills lines/warehouses from the GRN).
- All three engine calls happen inside `postPurchaseInvoice`, never inside a Server
  Action or component (Engine Driven principle) — the exact posture of spec 38's
  `postSalesInvoice`.

---

# Validation

Zod (`purchase-invoice-schema.ts`): `supplierId` uuid, `supplierInvoiceNumber` required
non-empty ≤ 50 (server checks the per-supplier uniqueness), `placeOfSupplyStateCode`
against `GST_STATE_CODES`, `invoiceDate` calendar date, `narration` ≤ 500, lines array
≥ 1 (`productId`/`warehouseId` uuid, `quantity` > 0 with unit precision, `rate` ≥ 0 ≤ 2
decimals, discount fields as prior specs, `ratePercent`/`cessPercent` 0–100 with ≤ 2
decimals — mirrors the GST Engine's own `GstRate` bounds (spec 33); these are normally
server-populated from the product's rate rather than client-authored, but are validated
here too, defensively, since the schema accepts the full line payload.
`overriddenCgst`/`overriddenSgst`/`overriddenIgst`/`overriddenCess` each ≥ 0 with ≤ 2
decimals when present, `overrideReason` required non-empty ≤ 500 when any overridden
field is set — an object-level refine ties `isTaxOverridden`, `overrideReason`, and the
overridden fields together: **exactly one** of the intra-state pair
(`overriddenCgst` + `overriddenSgst`) or the inter-state field (`overriddenIgst`) may be
set on a given line, never both pairs at once, and an overridden field may never appear
with `isTaxOverridden` left false or `overrideReason` blank), payments array (`ledgerId`
uuid — server re-verifies it is active, company-owned, and either the Cash-in-Hand
ledger or a `BankAccount`-linked ledger, rejecting any other ledger type — `amount` > 0
≤ 2 decimals).

---

# UI

Pages (under the `/purchase` hub)

- `/purchase/invoices` — Purchase Invoice list (Number, Supplier Invoice Number,
  Supplier, Date, Status, Grand Total, Paid, Actions) with search + status/supplier/date
  filters
- `/purchase/invoices/new` — Create Purchase Invoice (optionally pre-filled from a GRN's
  "Create Invoice" action)
- `/purchase/invoices/[id]` — View Purchase Invoice (read-only detail once posted, tax
  breakdown, payment breakdown, status actions: Post / Cancel — **no Print action**; a
  Purchase Invoice's authoritative document is the supplier's own bill, not one this
  system generates)
- `/purchase/invoices/[id]/edit` — Edit Purchase Invoice (only reachable while `DRAFT`)
- Extend the existing Company Settings "Sales & GST Ledgers" section (spec 38) into a
  combined "Sales & Purchase GST Ledgers" section, adding five new Ledger Selector
  fields (Purchase Account, Input CGST, Input SGST, Input IGST, Input Cess) alongside
  the existing Round Off selector (shared, not duplicated).

Components (`src/modules/purchase-invoices/components/`): Purchase Invoice Table (+
filter bar), Purchase Invoice Form (line editor with per-line "Override Tax" toggle,
payment-lines editor), Tax Override Dialog (shared component, extracted from spec 38 if
not already), Purchase Invoice Status Badge.

Wire-up

- Add a "Purchase Invoices" card to the `/purchase` hub page.
- Add `purchase-invoices: "Purchase Invoices"` to `src/constants/breadcrumbs.ts`.

---

# Security

Gated by the `purchase` permission module: `view`, `create`, `edit` (update while
`DRAFT`), `approve` used by Post when a tax override is present on any line (mirrors
Sales Invoice's below-cost-requires-approve pattern, applied here to overrides instead,
since a purchase has no below-cost concept), `delete` not implemented, `export`. The
extended Company Settings section is gated by `settings`/`edit`, not `purchase`.

---

# Database

New enum `PurchaseInvoiceStatus`; new models `PurchaseInvoice`, `PurchaseInvoiceItem`,
`PurchaseInvoicePayment`; five new nullable FK columns on `CompanySettings` (reusing
`roundOffLedgerId` from spec 38). One migration. Back-relations on `Company`,
`FinancialYear`, `Supplier`, `Product`, `Warehouse`, `PurchaseOrder`,
`GoodsReceiptNote`, `Voucher`, `Ledger`, `User`. No seeding.

---

# Code Standards

Same as spec 38: strict TypeScript, no `any`, no arithmetic outside its owning engine,
Serializable transaction for posting, vitest coverage for: the full posting
orchestration (entry balancing across payment-split combinations, both round-off
directions), tax-override audit trail, HSN hard-block, cancellation's mirrored reversal,
ledger-mapping rejection matrix — missing, inactive, cross-company, and wrong-group,
one case per each of the five new fields plus the shared round-off field —
`supplierInvoiceNumber` per-supplier uniqueness rejection, the GRN line-matching
bijection (including the duplicate-`(productId, warehouseId, quantity)`-lines case), and
payment-overpayment rejection against the freshly recomputed `grandTotal`.

---

# Do Not

Do not implement

- Purchase Return (feature-spec 45)
- Credit-terms enforcement (advisory display of `Supplier.creditDays` only)
- Any on-the-fly Supplier creation
- Printing, PDF generation, or WhatsApp sharing (no browser-print exception here, unlike
  Sales Invoice — a supplier bill is not a document this system prints and hands out)
- Consolidated multi-GRN or multi-order invoicing

---

# Success Criteria

Verify

- Posting a Purchase Invoice produces a balanced `VoucherType.PURCHASE` voucher (Debit
  Purchase Account + Input Tax ledgers, Credit payments/Supplier Ledger, correct
  round-off direction) and a matching `StockTransactionType.PURCHASE`/`IN` stock
  transaction per line, atomically.
- A tax override stores both computed and overridden values, uses the overridden values
  in the posted voucher, and requires a non-empty reason; a negative or over-precision
  override amount, or an override setting both the intra-state pair and the inter-state
  field at once, is rejected.
- A taxed line with no HSN blocks posting unconditionally.
- Duplicate `(supplierId, supplierInvoiceNumber)` is rejected with a friendly error.
- A Purchase Invoice linked to a Goods Receipt Note is rejected before posting if the
  GRN's supplier, company, or linked purchase order disagrees with the invoice's own, or
  if any invoice line's product/warehouse/quantity doesn't match the GRN's lines exactly
  as a 1:1 bijection — including a GRN with duplicate `(productId, warehouseId,
  quantity)` lines, which still resolves deterministically rather than matching
  ambiguously.
- An overpayment (`Σ payments > grandTotal`, checked against the freshly recomputed
  total) is rejected before any engine call; `amountPaid` always equals `Σ payments`,
  never an independently entered value.
- A payment ledger that is neither the Cash-in-Hand ledger nor a `BankAccount`-linked
  ledger is rejected.
- A `DRAFT` Purchase Invoice persists with `invoiceNumber = null`; multiple `DRAFT`
  invoices coexist without a unique-constraint conflict; posting assigns the first real
  `invoiceNumber`.
- Cancelling a posted invoice produces a correct mirrored voucher reversal and matching
  reversed stock transaction.
- Missing, inactive, cross-company, or wrong-group any of the five new Company Settings
  ledger mappings (or the shared Round Off mapping) blocks posting with a specific,
  friendly error naming which mapping failed and why.
- `npx tsc --noEmit`, `npx eslint src prisma`, `npx vitest run`, and `next build` all
  pass; `/purchase/invoices*` and the extended Settings route appear in the build route
  table.

Feature-spec 44 (this spec) is `context/Phases/phase-tracker.md`'s Phase 4 item #42.
Feature-spec 45 (Purchase Return, tracker #43) depends on it.
