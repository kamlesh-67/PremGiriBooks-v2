# 39 - Sales Return

> Feature-spec file number 39. This feature is `context/Phases/phases.md`'s **Phase 3 —
> Sales Management** and `context/Phases/phase-tracker.md`'s Phase 3 item **#37 Sales
> Return**. Depends on Sales Invoice (feature-spec 38). Fifth of the seven Phase 3
> documents — the first of three invoice-adjustment documents (Sales Return, Credit
> Note, Debit Note), each scoped to a distinct, non-overlapping responsibility; read the
> "Relationship to Credit Note" note under Goal before implementing any of the three.

## Goal

Implement **Sales Return** for **Premgiri Books ERP** — the **physical, quantity-based**
reversal of a posted Sales Invoice: goods come back into stock, and the customer's
liability decreases by the returned lines' value. Both the `VoucherType.SALES_RETURN`
and `StockTransactionType.SALES_RETURN` enum members already exist (specs 31, 32) with
no other consumer — this document is what they were reserved for.

**Relationship to Credit Note and Debit Note (read before implementing any of the
three).** All three are invoice-adjustment documents, but scoped distinctly so none
overlaps another:

- **Sales Return** (this spec) — always tied to specific returned **quantities** of
  specific invoice lines; always moves stock (`IN`) and always posts a voucher. Use when
  goods physically come back.
- **Credit Note** (feature-spec 40) — a **pure financial** adjustment reducing what the
  customer owes, with **no stock movement** (price correction, post-invoice discount,
  rate dispute, or the accounting-side complement to a return already handled by *this*
  spec's own posting, when a business separately wants a GST-document-labeled "Credit
  Note" for filing purposes — optional, not required, since this spec already posts a
  complete, correct `SALES_RETURN` voucher on its own).
- **Debit Note** (feature-spec 41) — the mirror of Credit Note: increases what the
  customer owes (under-billing correction, additional post-invoice charges), no stock
  movement.

A business that returns goods needs only this spec; Credit Note is for adjustments with
no physical return.

---

# Project Context

Before implementation, review

- `38-sales-invoice.md` (**read this first** — the posted `SalesInvoice`/
  `SalesInvoiceItem` shape this spec reverses against, the Company Settings ledger
  mapping this spec reuses without adding its own, the cancellation pattern this spec's
  posting mirrors)
- `31-voucher-engine.md` (`VoucherType.SALES_RETURN`, `postVoucher`)
- `32-inventory-engine.md` (`StockTransactionType.SALES_RETURN`, direction `IN`,
  `recordMovements`)
- `33-gst-engine.md` (`calculateLine` — reused for the returned-line tax breakdown,
  using the **original invoice's** `supplyType`/rate/cess snapshot, never re-derived)
- `34-document-number-engine.md` (`DocumentType.SALES_RETURN`)

---

# Module Responsibilities

The Sales Return module is responsible for

- Sales Return Master (Create/Post/View/Cancel, scoped to the active company and
  financial year), always referencing exactly one posted Sales Invoice
- Per-line returned quantity, capped at that invoice line's original quantity minus any
  already-returned quantity across prior Sales Returns against the same invoice
- Posting, atomically: a `StockTransactionType.SALES_RETURN`/`IN` stock movement per
  returned line and a balanced `VoucherType.SALES_RETURN` voucher, reusing
  `38-sales-invoice.md`'s Company Settings ledger mapping with entries reversed
- Sales Return numbering via the Document Number Engine (`DocumentType.SALES_RETURN`)

The Sales Return module is **not** responsible for

- Credit Note or Debit Note (specs 40, 41)
- Returns against an unposted, cancelled, or non-existent invoice
- Refund-method nuance beyond the two documented options (Business Rules) — no cheque/
  wallet/gift-card infra exists anywhere in this codebase

---

# Data Model

Add to `prisma/schema.prisma` (plus `salesReturns SalesReturn[]` back-relations on
`Company`, `FinancialYear`, `SalesInvoice`, `User`):

```text
enum SalesReturnStatus {
  DRAFT
  POSTED
  CANCELLED
}

enum RefundMode {
  LEDGER_ADJUSTMENT
  CASH_REFUND
}

model SalesReturn {
  id              String            @id @default(uuid())
  companyId       String
  company         Company           @relation(fields: [companyId], references: [id])
  financialYearId String
  financialYear   FinancialYear     @relation(fields: [financialYearId], references: [id])
  returnNumber    String?           // null until posted, see Decisions
  returnDate      DateTime          @db.Date
  salesInvoiceId  String
  salesInvoice    SalesInvoice      @relation(fields: [salesInvoiceId], references: [id])
  refundMode      RefundMode        @default(LEDGER_ADJUSTMENT)
  refundLedgerId  String?
  refundLedger    Ledger?           @relation(fields: [refundLedgerId], references: [id])
  status          SalesReturnStatus @default(DRAFT)
  reason          String?
  taxableAmount   Decimal           @db.Decimal(14, 2)
  totalCgst       Decimal           @db.Decimal(14, 2)
  totalSgst       Decimal           @db.Decimal(14, 2)
  totalIgst       Decimal           @db.Decimal(14, 2)
  totalCess       Decimal           @db.Decimal(14, 2)
  grandTotal      Decimal           @db.Decimal(14, 2)
  voucherId       String?           @unique
  voucher         Voucher?          @relation(fields: [voucherId], references: [id])
  createdByUserId String?
  createdBy       User?             @relation(fields: [createdByUserId], references: [id])
  createdAt       DateTime          @default(now())
  updatedAt       DateTime          @updatedAt

  items SalesReturnItem[]

  @@unique([companyId, financialYearId, returnNumber])
  @@index([companyId, salesInvoiceId])
  @@index([companyId, status])
}

model SalesReturnItem {
  id                 String      @id @default(uuid())
  salesReturnId      String
  salesReturn        SalesReturn @relation(fields: [salesReturnId], references: [id])
  lineNumber         Int
  salesInvoiceItemId String
  salesInvoiceItem   SalesInvoiceItem @relation(fields: [salesInvoiceItemId], references: [id])
  quantity           Decimal     @db.Decimal(14, 4)
  taxableAmount      Decimal     @db.Decimal(14, 2)
  cgst               Decimal     @db.Decimal(14, 2)
  sgst               Decimal     @db.Decimal(14, 2)
  igst               Decimal     @db.Decimal(14, 2)
  cess               Decimal     @db.Decimal(14, 2)
  totalAmount        Decimal     @db.Decimal(14, 2)

  @@unique([salesReturnId, lineNumber])
  @@unique([salesReturnId, salesInvoiceItemId])
  @@index([salesInvoiceItemId])
}
```

Decisions

- **No independent product/rate entry** — every line references a `SalesInvoiceItem`
  directly and derives `rate`/`ratePercent`/`cessPercent`/`warehouseId` from it (using
  the **overridden** tax values when the source line was tax-overridden, per spec 38's
  audit trail) — a return cannot invent a different price or tax treatment than what was
  actually invoiced. Only `quantity` (≤ the returnable remainder) is entered.
  `@@unique([salesReturnId, salesInvoiceItemId])` prevents the same invoice line from
  being listed twice within one return (which would otherwise let the returnable-quantity
  math and the stock/voucher posting both process one invoice line as two independent
  entries) — a business returning more of the same line simply increases that one line's
  `quantity`, not adds a second row for the same `salesInvoiceItemId`.
- **`refundMode`** — `LEDGER_ADJUSTMENT` (the Prisma column default, for the common
  `PERMANENT`/converted-`QUICK`-source case): reduces the customer's outstanding ledger
  balance, no cash moves. `CASH_REFUND`: cash/bank actually leaves the business, requiring
  `refundLedgerId` (any active company Ledger, typically Cash-in-Hand or a Bank Account
  ledger — the same explicit-per-transaction convention as `38-sales-invoice.md`'s payment
  lines). `refundLedgerId` is required when and only when `refundMode = CASH_REFUND`
  (object-level Zod refine). **Resolution order for a `WALK_IN`-sourced return** (the
  schema's own column default is a plain fallback, not aware of the source invoice's
  mode): `createDraft` resolves the source `salesInvoiceId`'s `customerMode` **before**
  persisting anything, and for a `WALK_IN` source forces `refundMode = CASH_REFUND`
  regardless of the Prisma default or any client-supplied value — an explicit
  `LEDGER_ADJUSTMENT` submitted for a `WALK_IN`-sourced return is rejected outright (not
  silently overridden), matching the Business Rules enforcement below.
- **`returnNumber` is nullable, assigned only at posting** — a `DRAFT` Sales Return has
  no committed identity yet (the Document Number Engine's `generateNumber` step runs
  inside `postSalesReturn`'s own transaction, per spec 34's contract, not at
  `createDraft` time — the same lifecycle `44-purchase-invoice.md`'s `invoiceNumber`
  follows). The `@@unique([companyId, financialYearId, returnNumber])` constraint still
  holds correctly with multiple `DRAFT` rows coexisting, since Postgres unique indexes
  treat `NULL` values as distinct from one another — not a gap in the constraint, exactly
  why the column can stay nullable without risking a false collision. `createDraft` and
  `updateDraft` never set `returnNumber`; `postSalesReturn` is the only writer.
- **No `branchId`**, same posture as every spec in this phase.

---

# Business Rules

- **Requires a `POSTED` Sales Invoice** — `salesInvoiceId` must reference an invoice with
  `status = POSTED` belonging to the same company; a `DRAFT`/`CANCELLED` invoice is
  rejected as not-returnable.
- **Line/header consistency**: every `SalesReturnItem.salesInvoiceItemId` must belong to
  the header's own `salesInvoiceId` and the same company — validated server-side before
  computing returnable quantities, stock movements, or voucher entries; a line
  referencing a different invoice's item is rejected outright (this guards against a
  client submitting an item id from an unrelated invoice, not just a trusted
  assumption).
- **Returnable quantity**: for each `salesInvoiceItemId`, the maximum returnable quantity
  is `salesInvoiceItem.quantity − Σ(quantity of prior SalesReturnItems whose parent
  SalesReturn has status = POSTED, against that same salesInvoiceItemId)`. **`DRAFT`
  returns are excluded from this sum entirely** — an unposted draft has not actually
  consumed any returnable capacity; it may still be edited, abandoned, or never posted,
  so counting it would incorrectly shrink what a *different* return can claim before this
  one even commits (there is no draft-reservation/hold concept in this phase). A
  `CANCELLED` return's quantity is excluded too, since its reversal already gave the
  capacity back. **Concurrency safety, made explicit**: `postSalesReturn` computes this
  sum and posts inside one **Serializable transaction with the same bounded-retry
  contract as `37-delivery-challans.md`'s dispatch flow** (spec 32's
  `SERIALIZABLE_RETRY` convention), so two concurrent posts against the same invoice line
  cannot both observe the same pre-posting returnable quantity and both succeed — the
  losing transaction retries up to the bounded limit and re-observes the now-reduced
  returnable quantity, surfacing a friendly "insufficient returnable quantity" error on
  that retry if it no longer fits.
- **Editable while `DRAFT`.** Posting freezes the document; no update API accepts a
  `POSTED`-or-later return's id.
- **Posting (`postSalesReturn`, one transaction)**: mirrors `38-sales-invoice.md`'s
  posting orchestration with the direction reversed —
  1. Inside the same Serializable transaction as the returnable-quantity check (not a
     separate pre-check that could go stale before the transaction opens): re-verify the
     source invoice's `status` is still `POSTED` (it may have been cancelled since this
     return was drafted); re-verify every line's `salesInvoiceItemId` still belongs to
     `salesInvoiceId` and the same company (the Line/header consistency rule above,
     re-checked against current state, not just at draft-creation time); when
     `refundMode = CASH_REFUND`, re-verify `refundLedgerId` is still active and
     company-owned. Reject on any failure before computing returnable quantity.
  2. Re-validate returnable quantity against current state.
  3. Recompute each line's taxable/tax amounts from the source invoice line's per-unit
     rate/tax (its **overridden** values when applicable) × returned quantity, rounded
     per the GST Engine's own per-line rounding policy.
  4. Generate `returnNumber` (`DocumentType.SALES_RETURN`, spec 34's two-step contract)
     — the first time this row receives a real number (see Decisions).
  5. `inventoryEngine.recordMovements(companyId, lines, tx)` —
     `StockTransactionType.SALES_RETURN`/`IN`, one line per returned item,
     `referenceType = "SALES_RETURN"`, same `warehouseId` the original invoice line used.
  6. Build the balanced voucher (see Ledger Posting) and call `voucherEngine.postVoucher`
     (`VoucherType.SALES_RETURN`).
  7. Set `status = POSTED`, `voucherId`.
- **Ledger Posting**: **Debit** `CompanySettings.salesLedgerId` for the returned
  `taxableAmount` and `outputCgstLedgerId`/`outputSgstLedgerId`/`outputIgstLedgerId`/
  `outputCessLedgerId` for their respective returned totals (reusing
  `38-sales-invoice.md`'s mapping — the same six-field-missing rejection applies here
  too). **Credit** the customer's Ledger (`LEDGER_ADJUSTMENT`) or `refundLedgerId`
  (`CASH_REFUND`) for `grandTotal`. A `WALK_IN`-mode source invoice has no customer
  ledger — its returns must use `CASH_REFUND` (enforced: `refundMode` defaults to and
  cannot be changed from `CASH_REFUND` when the source invoice's `customerMode` is
  `WALK_IN`).
- **Cancellation**: `cancelSalesReturn(id)` — only a `POSTED` return; mirrors
  `voucherEngine.cancelVoucher` and reverses the stock movement (`OUT`, undoing the
  earlier `IN`) atomically, matching `38-sales-invoice.md`'s own cancellation shape.
- **Company-scoped for every user**, identical posture to specs 35–38.

---

# Service / Repository

Create

```text
src/modules/sales-returns/repositories/sales-return-repository.ts
src/modules/sales-returns/services/sales-return-service.ts
src/modules/sales-returns/validation/sales-return-schema.ts
src/modules/sales-returns/actions/sales-return-actions.ts
src/modules/sales-returns/components/…
src/types/sales-return.ts
```

- `salesReturnService`: `listSalesReturns(filters)`, `getSalesReturn(id)`,
  `createDraft(salesInvoiceId, lines)` (pre-fills each line's cap from remaining
  returnable quantity), `updateDraft(id, input)` (only while `DRAFT`),
  `postSalesReturn(id)`, `cancelSalesReturn(id)`, `getReturnableQuantities
  (salesInvoiceId)` (the lookup the create form reads from).
- Engine calls live in the service, following `38-sales-invoice.md`'s orchestration
  posture exactly.

---

# Validation

Zod (`sales-return-schema.ts`): `salesInvoiceId` uuid, `returnDate` calendar date on or
after the source invoice's `invoiceDate`, `reason` optional ≤ 500, `refundMode` enum with
the conditional-`refundLedgerId` refine described above, lines array ≥ 1
(`salesInvoiceItemId` uuid, `quantity` > 0 with unit precision — the returnable-cap check
itself is server-computed, not a static Zod bound).

---

# UI

Pages (under the `/sales` hub)

- `/sales/returns` — Sales Return list (Number, Invoice Number, Date, Grand Total,
  Status, Actions) with search + status/date filters
- `/sales/returns/new` — Create Sales Return (starts from an invoice search/select,
  then shows only that invoice's lines with their remaining returnable quantity)
- `/sales/returns/[id]` — View Sales Return (read-only detail, status actions: Post /
  Cancel)
- `/sales/returns/[id]/edit` — Edit Sales Return (only reachable while `DRAFT`)

Components (`src/modules/sales-returns/components/`): Sales Return Table (+ filter bar),
Sales Return Form (invoice picker + returnable-quantity-capped line editor, refund-mode
toggle), Sales Return Status Badge.

Wire-up

- Add a "Sales Returns" card to the `/sales` hub page.
- Add `returns: "Sales Returns"` to `src/constants/breadcrumbs.ts`.

---

# Security

Gated by the `sales` permission module: `view`, `create`, `edit` (update while `DRAFT`),
`approve` used by Post (a return decreases recognized revenue — treated with the same
posture as Sales Invoice's below-cost gate, but here unconditional: **every** Sales
Return post requires `approve`, not just below-cost cases, since a return is inherently a
correction to an already-posted financial record), `delete` not implemented. Company-
scoped identically to specs 35–38.

---

# Database

New enums `SalesReturnStatus`, `RefundMode`; new models `SalesReturn`, `SalesReturnItem`.
One migration. Back-relations on `Company`, `FinancialYear`, `SalesInvoice`,
`SalesInvoiceItem`, `Voucher`, `Ledger`, `User`. No seeding.

---

# Code Standards

Same as spec 38: strict TypeScript, no `any`, no arithmetic outside its owning engine,
transactional posting/cancellation, vitest coverage for: the returnable-quantity race
guard across multiple partial returns against the same invoice line, the `WALK_IN`-forces-
`CASH_REFUND` rule, ledger-posting balance across both refund modes, cancellation's
mirrored reversal, numbering uniqueness, missing-ledger-mapping rejection (reusing spec
38's six-field matrix).

---

# Do Not

Do not implement

- Credit Note or Debit Note (specs 40, 41)
- Returns against a `DRAFT` or `CANCELLED` invoice
- A separate Credit Note auto-generated from this document (optional/manual only, per
  the Goal's Relationship note — a business wanting both files a Credit Note, spec 40,
  itself)
- Cheque/wallet/gift-card refund methods
- Printing, PDF generation, or WhatsApp sharing (deferred identically to specs 35–38)

---

# Success Criteria

Verify

- A `SalesReturnItem` referencing a `salesInvoiceItemId` that does not belong to the
  header's own `salesInvoiceId` is rejected outright; the same `salesInvoiceItemId`
  cannot appear twice within one return (`@@unique([salesReturnId, salesInvoiceItemId])`).
  A `DRAFT` Sales Return persists with `returnNumber = null`; multiple `DRAFT` returns
  coexist without a unique-constraint conflict; posting assigns the first real
  `returnNumber`.
- A Sales Return against a posted invoice caps each line at its correctly-computed
  remaining returnable quantity, including across two sequential partial returns.
- Posting is rejected if the source invoice was cancelled after this return was drafted,
  or if a `CASH_REFUND`'s `refundLedgerId` was deactivated in the meantime — both
  re-checked inside the same Serializable posting transaction, not just at
  draft-creation time.
- Posting produces a balanced `VoucherType.SALES_RETURN` voucher and a matching
  `StockTransactionType.SALES_RETURN`/`IN` stock transaction per line, atomically.
- A `WALK_IN`-sourced return is forced to `CASH_REFUND` and requires a `refundLedgerId`;
  a `LEDGER_ADJUSTMENT` return correctly reduces the customer's ledger instead.
- Cancelling a posted return produces a correct mirrored voucher reversal and reversed
  stock transaction.
- `npx tsc --noEmit`, `npx eslint src prisma`, `npx vitest run`, and `next build` all
  pass; `/sales/returns*` appears in the build route table.

Feature-spec 39 (this spec) is `context/Phases/phase-tracker.md`'s Phase 3 item #37.
