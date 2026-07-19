# 45 - Purchase Return

> Feature-spec file number 45. This feature is `context/Phases/phases.md`'s **Phase 4 —
> Purchase Management** and `context/Phases/phase-tracker.md`'s Phase 4 item **#43
> Purchase Return** — the last item in Phase 4. Depends on Purchase Invoice (feature-spec
> 44). Fourth and last of Phase 4's documents; the mirror of `39-sales-return.md` with
> the ledger and stock direction reversed. Read that spec first — this one records
> mainly what differs, including one structural difference: **there is no Purchase-side
> Credit Note / Debit Note pair** (see Goal).

## Goal

Implement **Purchase Return** for **Premgiri Books ERP** — the **physical, quantity-
based** reversal of a posted Purchase Invoice: goods go back out to the supplier, and
what the business owes that supplier decreases. Both `VoucherType.PURCHASE_RETURN` and
`StockTransactionType.PURCHASE_RETURN` already exist (specs 31, 32) with no other
consumer — this document is what they were reserved for.

**Structural note, unlike the Sales side.** `context/Phases/phase-tracker.md`'s Phase 4
table has exactly **four** items (#40–#43) — Purchase Order, Goods Receipt Note, Purchase
Invoice, Purchase Return — with no Purchase-side Credit Note / Debit Note pair, unlike
Phase 3's three-way split (Sales Return / Credit Note / Debit Note, specs 39–41). This
spec is therefore **the sole adjustment document for purchases**: it must be
self-sufficient for both physical returns (its primary purpose, mirroring Sales Return)
and — since no separate financial-only document exists on this side — is also the only
place a purchase-side value correction with no physical movement could be recorded, *if*
one is ever needed (see Do Not: not built here, since the tracker does not ask for it;
recorded as a known asymmetry with Phase 3, not resolved speculatively).

---

# Project Context

Before implementation, review

- `39-sales-return.md` (**read this first in full**, including its "Relationship to
  Credit Note" note — this spec mirrors its shape with directions reversed, and this
  spec's own Goal note above explains the one structural asymmetry)
- `44-purchase-invoice.md` (the posted `PurchaseInvoice`/`PurchaseInvoiceItem` shape
  this spec reverses against, and the Company Settings ledger mapping — Purchase
  Account + Input Tax ledgers — this spec reuses without adding its own)
- `31-voucher-engine.md` (`VoucherType.PURCHASE_RETURN`), `32-inventory-engine.md`
  (`StockTransactionType.PURCHASE_RETURN`, direction `OUT` — goods leaving *our*
  warehouse back to the supplier, the opposite direction from Sales Return's `IN`),
  `33-gst-engine.md` (`calculateLine`, reused against the original invoice line's
  snapshot), `34-document-number-engine.md` (`DocumentType.PURCHASE_RETURN`)

---

# Module Responsibilities

The Purchase Return module is responsible for

- Purchase Return Master (Create/Post/View/Cancel, scoped to the active company and
  financial year), always referencing exactly one posted Purchase Invoice
- Per-line returned quantity, capped at that invoice line's original quantity minus any
  already-returned quantity across prior Purchase Returns against the same invoice
- Posting, atomically: a `StockTransactionType.PURCHASE_RETURN`/`OUT` stock movement per
  returned line and a balanced `VoucherType.PURCHASE_RETURN` voucher, reusing
  `44-purchase-invoice.md`'s Company Settings ledger mapping with entries reversed
- Purchase Return numbering via the Document Number Engine
  (`DocumentType.PURCHASE_RETURN`)

The Purchase Return module is **not** responsible for

- Any Purchase-side Credit Note / Debit Note (no such document exists in this phase's
  scope — see Goal)
- Returns against an unposted, cancelled, or non-existent invoice

---

# Data Model

Add to `prisma/schema.prisma` (plus `purchaseReturns PurchaseReturn[]` back-relations on
`Company`, `FinancialYear`, `PurchaseInvoice`, `User`):

```text
enum PurchaseReturnStatus {
  DRAFT
  POSTED
  CANCELLED
}

model PurchaseReturn {
  id                String               @id @default(uuid())
  companyId         String
  company           Company              @relation(fields: [companyId], references: [id])
  financialYearId   String
  financialYear     FinancialYear        @relation(fields: [financialYearId], references: [id])
  returnNumber      String
  returnDate        DateTime             @db.Date
  purchaseInvoiceId String
  purchaseInvoice   PurchaseInvoice      @relation(fields: [purchaseInvoiceId], references: [id])
  refundMode        RefundMode           @default(LEDGER_ADJUSTMENT) // reused enum, spec 39
  refundLedgerId    String?
  refundLedger      Ledger?              @relation(fields: [refundLedgerId], references: [id])
  status            PurchaseReturnStatus @default(DRAFT)
  reason            String?
  taxableAmount     Decimal              @db.Decimal(14, 2)
  totalCgst         Decimal              @db.Decimal(14, 2)
  totalSgst         Decimal              @db.Decimal(14, 2)
  totalIgst         Decimal              @db.Decimal(14, 2)
  totalCess         Decimal              @db.Decimal(14, 2)
  grandTotal        Decimal              @db.Decimal(14, 2)
  voucherId         String?              @unique
  voucher           Voucher?             @relation(fields: [voucherId], references: [id])
  createdByUserId   String?
  createdBy         User?                @relation(fields: [createdByUserId], references: [id])
  createdAt         DateTime             @default(now())
  updatedAt         DateTime             @updatedAt

  items PurchaseReturnItem[]

  @@unique([companyId, financialYearId, returnNumber])
  @@index([companyId, purchaseInvoiceId])
  @@index([companyId, status])
}

model PurchaseReturnItem {
  id                    String         @id @default(uuid())
  purchaseReturnId      String
  purchaseReturn        PurchaseReturn @relation(fields: [purchaseReturnId], references: [id])
  lineNumber            Int
  purchaseInvoiceItemId String
  purchaseInvoiceItem   PurchaseInvoiceItem @relation(fields: [purchaseInvoiceItemId], references: [id])
  quantity              Decimal        @db.Decimal(14, 4)
  taxableAmount         Decimal        @db.Decimal(14, 2)
  cgst                  Decimal        @db.Decimal(14, 2)
  sgst                  Decimal        @db.Decimal(14, 2)
  igst                  Decimal        @db.Decimal(14, 2)
  cess                  Decimal        @db.Decimal(14, 2)
  totalAmount           Decimal        @db.Decimal(14, 2)

  @@unique([purchaseReturnId, lineNumber])
  @@index([purchaseInvoiceItemId])
}
```

Decisions

- Identical shape to `39-sales-return.md`'s `SalesReturn`/`SalesReturnItem` with
  `purchaseInvoiceId`/`purchaseInvoiceItemId` in place of `salesInvoiceId`/
  `salesInvoiceItemId` — no independent product/rate entry, every line derives its
  rate/tax from the source invoice line (using overridden values when applicable),
  only `quantity` is entered.
- **`refundMode`/`refundLedgerId`** — reuses spec 39's `RefundMode` enum. Here,
  `LEDGER_ADJUSTMENT` reduces what the business owes the supplier (Sundry Creditors);
  `CASH_REFUND` models the supplier actually returning cash/bank funds to the business
  (via `refundLedgerId`, any active company Ledger) — the mirror of Sales Return's two
  options, same conditional-`refundLedgerId` validation rule.
- No `branchId`, same posture as every spec in this project.

---

# Business Rules

Identical structure to `39-sales-return.md`'s, with the ledger and stock direction
reversed:

- **Requires a `POSTED` Purchase Invoice.**
- **Returnable quantity**: capped per `purchaseInvoiceItemId` at original quantity minus
  already-returned quantity, re-checked inside the posting transaction (the same race
  guard).
- **Editable while `DRAFT`.** Posting freezes the document.
- **Posting (`postPurchaseReturn`, one transaction)**: recompute each line's tax from
  the source invoice line's per-unit rate/tax (its overridden values when applicable),
  generate `returnNumber` (`DocumentType.PURCHASE_RETURN`), call
  `inventoryEngine.recordMovements` — `StockTransactionType.PURCHASE_RETURN`/**`OUT`**
  (the reversed direction from Sales Return's `IN` — goods leave *our* warehouse back to
  the supplier), build the balanced voucher and call `voucherEngine.postVoucher`
  (`VoucherType.PURCHASE_RETURN`), set `status = POSTED` + `voucherId`.
- **Ledger Posting** (the reversal of Purchase Invoice's, mirroring Sales Return's own
  reversal of Sales Invoice's): **Credit** `CompanySettings.purchaseLedgerId` for the
  returned `taxableAmount` and `inputCgstLedgerId`/`inputSgstLedgerId`/
  `inputIgstLedgerId`/`inputCessLedgerId` for their respective returned totals (reusing
  spec 44's mapping and its missing-mapping rejection). **Debit** the supplier's Ledger
  (`LEDGER_ADJUSTMENT`) or `refundLedgerId` (`CASH_REFUND`) for `grandTotal`.
- **Cancellation**: `cancelPurchaseReturn(id)` — only a `POSTED` return; mirrors
  `voucherEngine.cancelVoucher` and reverses the stock movement (`IN`, undoing the
  earlier `OUT`) atomically.
- **Company-scoped for every user**, identical posture to every spec in this phase.

---

# Service / Repository

Create

```text
src/modules/purchase-returns/repositories/purchase-return-repository.ts
src/modules/purchase-returns/services/purchase-return-service.ts
src/modules/purchase-returns/validation/purchase-return-schema.ts
src/modules/purchase-returns/actions/purchase-return-actions.ts
src/modules/purchase-returns/components/…
src/types/purchase-return.ts
```

- `purchaseReturnService`: `listPurchaseReturns(filters)`, `getPurchaseReturn(id)`,
  `createDraft(purchaseInvoiceId, lines)` (pre-fills each line's cap from remaining
  returnable quantity), `updateDraft(id, input)` (only while `DRAFT`),
  `postPurchaseReturn(id)`, `cancelPurchaseReturn(id)`, `getReturnableQuantities
  (purchaseInvoiceId)`.

---

# Validation

Zod (`purchase-return-schema.ts`) — identical shape to `sales-return-schema.ts` with
`purchaseInvoiceId` in place of `salesInvoiceId`.

---

# UI

Pages (under the `/purchase` hub)

- `/purchase/returns` — Purchase Return list (Number, Invoice Number, Date, Grand Total,
  Status, Actions) with search + status/date filters
- `/purchase/returns/new` — Create Purchase Return (starts from an invoice search/
  select, then shows only that invoice's lines with remaining returnable quantity)
- `/purchase/returns/[id]` — View Purchase Return (read-only detail, status actions:
  Post / Cancel)
- `/purchase/returns/[id]/edit` — Edit Purchase Return (only reachable while `DRAFT`)

Components (`src/modules/purchase-returns/components/`): Purchase Return Table (+ filter
bar), Purchase Return Form (invoice picker + returnable-quantity-capped line editor,
refund-mode toggle), Purchase Return Status Badge.

Wire-up

- Add a "Purchase Returns" card to the `/purchase` hub page — **this is the fourth and
  final card**, completing the `/purchase` hub started in `42-purchase-orders.md`.
- Add `purchase-returns: "Purchase Returns"` to `src/constants/breadcrumbs.ts`.

---

# Security

Gated by the `purchase` permission module: `view`, `create`, `edit` (update while
`DRAFT`), `approve` used by Post (unconditional, same posture as Sales Return's Post —
every Purchase Return corrects an already-posted financial record), `delete` not
implemented. Company-scoped identically to every spec in this phase.

---

# Database

New enums `PurchaseReturnStatus` (reuses spec 39's `RefundMode`, no new one); new models
`PurchaseReturn`, `PurchaseReturnItem`. One migration. Back-relations on `Company`,
`FinancialYear`, `PurchaseInvoice`, `PurchaseInvoiceItem`, `Voucher`, `Ledger`, `User`.
No seeding.

---

# Code Standards

Same as spec 44 (and its Sales Return mirror): strict TypeScript, no `any`, no
arithmetic outside its owning engine, transactional posting/cancellation, vitest
coverage for: the returnable-quantity race guard, ledger-posting balance across both
refund modes (asserting the reversed direction explicitly, not just by symmetry with
spec 39's suite), cancellation's mirrored reversal, numbering uniqueness, missing-
ledger-mapping rejection (reusing spec 44's five-plus-shared-round-off matrix).

---

# Do Not

Do not implement

- A Purchase-side Credit Note / Debit Note pair — not asked for by
  `context/Phases/phase-tracker.md`'s Phase 4 table (see Goal's structural note); if a
  future need arises for a purchase-side financial-only adjustment with no physical
  return, it is a new feature-spec's job to scope, not a speculative addition here
- Returns against a `DRAFT` or `CANCELLED` invoice
- Printing, PDF generation, or WhatsApp sharing (deferred identically to every spec in
  this project)

---

# Success Criteria

Verify

- A Purchase Return against a posted invoice caps each line at its correctly-computed
  remaining returnable quantity, including across two sequential partial returns.
- Posting produces a balanced `VoucherType.PURCHASE_RETURN` voucher and a matching
  `StockTransactionType.PURCHASE_RETURN`/`OUT` stock transaction per line, atomically.
- Ledger posting correctly reverses Purchase Invoice's direction (Credit Purchase
  Account + Input Tax, Debit Supplier/refund ledger) for both refund modes.
- Cancelling a posted return produces a correct mirrored voucher reversal and reversed
  stock transaction.
- `npx tsc --noEmit`, `npx eslint src prisma`, `npx vitest run`, and `next build` all
  pass; `/purchase/returns*` appears in the build route table.

Feature-spec 45 (this spec) is `context/Phases/phase-tracker.md`'s Phase 4 item #43 —
**the last item in Phase 4 (Purchase Management)**. Per `context/Phases/phase-
tracker.md`, Phase 5 (Inventory — Opening Stock, Stock Adjustment, Stock Transfer,
Physical Verification, Batch Tracking, Serial Number Tracking, #44–#49) is next, followed
by Phase 6 (Accounting — the four manual voucher screens, #50–#53).
