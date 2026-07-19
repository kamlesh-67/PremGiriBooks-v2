# 40 - Credit Note

> Feature-spec file number 40. This feature is `context/Phases/phases.md`'s **Phase 3 —
> Sales Management** and `context/Phases/phase-tracker.md`'s Phase 3 item **#38 Credit
> Note**. Depends on Sales Invoice (feature-spec 38). Sixth of the seven Phase 3
> documents. Read `39-sales-return.md`'s Goal note ("Relationship to Credit Note and
> Debit Note") before implementing this spec — it defines the boundary between the two
> financial-adjustment documents and this spec's sibling, the physical-return document.

## Goal

Implement **Credit Note** for **Premgiri Books ERP** — a **pure financial adjustment**
that reduces what a customer owes, with **no stock movement**. Unlike Sales Return
(feature-spec 39), a Credit Note is not tied to returned quantities of specific products;
it covers price corrections, post-invoice discounts, rate disputes, or (optionally) the
formal GST-document-labeled complement to a return a business already recorded through
Sales Return's own self-sufficient posting.

`VoucherType.CREDIT_NOTE` already exists (spec 31) with no other consumer — this document
is what it was reserved for.

---

# Project Context

Before implementation, review

- `39-sales-return.md` (**read its Goal note first** — the three-way scope boundary)
- `38-sales-invoice.md` (the Company Settings ledger mapping this spec reuses without
  adding its own; the `SalesInvoice`/`SalesInvoiceItem` shape a Credit Note may
  optionally reference for context)
- `31-voucher-engine.md` (`VoucherType.CREDIT_NOTE`, `postVoucher`)
- `33-gst-engine.md` (`calculateLine` — reused for each adjustment line's tax breakdown)
- `34-document-number-engine.md` (`DocumentType.CREDIT_NOTE`)

---

# Module Responsibilities

The Credit Note module is responsible for

- Credit Note Master (Create/Post/View/Cancel, scoped to the active company and
  financial year)
- Freeform adjustment lines (description + taxable amount + GST rate/cess, **not**
  product/quantity — see Data Model) — the one difference from Sales Return's product-
  line shape
- Posting, atomically: a balanced `VoucherType.CREDIT_NOTE` voucher, reusing
  `38-sales-invoice.md`'s Company Settings ledger mapping
- Credit Note numbering via the Document Number Engine (`DocumentType.CREDIT_NOTE`)

The Credit Note module is **not** responsible for

- Any stock movement (Sales Return, spec 39, is the only Phase 3 document that touches
  the Inventory Engine on the return/adjustment side)
- Sales Return or Debit Note (specs 39, 41)

---

# Data Model

Add to `prisma/schema.prisma` (plus `creditNotes CreditNote[]` back-relations on
`Company`, `FinancialYear`, `Customer`, `SalesInvoice`, `User`):

```text
enum CreditNoteStatus {
  DRAFT
  POSTED
  CANCELLED
}

model CreditNote {
  id              String           @id @default(uuid())
  companyId       String
  company         Company          @relation(fields: [companyId], references: [id])
  financialYearId String
  financialYear   FinancialYear    @relation(fields: [financialYearId], references: [id])
  noteNumber      String
  noteDate        DateTime         @db.Date
  customerId      String
  customer        Customer         @relation(fields: [customerId], references: [id])
  salesInvoiceId  String?
  salesInvoice    SalesInvoice?    @relation(fields: [salesInvoiceId], references: [id])
  placeOfSupplyStateCode String
  refundMode      RefundMode       @default(LEDGER_ADJUSTMENT) // reused enum, spec 39
  refundLedgerId  String?
  refundLedger    Ledger?          @relation(fields: [refundLedgerId], references: [id])
  status          CreditNoteStatus @default(DRAFT)
  reason          String
  taxableAmount   Decimal          @db.Decimal(14, 2)
  totalCgst       Decimal          @db.Decimal(14, 2)
  totalSgst       Decimal          @db.Decimal(14, 2)
  totalIgst       Decimal          @db.Decimal(14, 2)
  totalCess       Decimal          @db.Decimal(14, 2)
  grandTotal      Decimal          @db.Decimal(14, 2)
  voucherId       String?          @unique
  voucher         Voucher?         @relation(fields: [voucherId], references: [id])
  createdByUserId String?
  createdBy       User?            @relation(fields: [createdByUserId], references: [id])
  createdAt       DateTime         @default(now())
  updatedAt       DateTime         @updatedAt

  items CreditNoteItem[]

  @@unique([companyId, financialYearId, noteNumber])
  @@index([companyId, customerId])
  @@index([companyId, status])
}

model CreditNoteItem {
  id              String     @id @default(uuid())
  creditNoteId    String
  creditNote      CreditNote @relation(fields: [creditNoteId], references: [id])
  lineNumber      Int
  description     String
  taxableAmount   Decimal    @db.Decimal(14, 2)
  ratePercent     Decimal    @db.Decimal(5, 2)
  cessPercent     Decimal    @db.Decimal(5, 2) @default(0)
  cgst            Decimal    @db.Decimal(14, 2)
  sgst            Decimal    @db.Decimal(14, 2)
  igst            Decimal    @db.Decimal(14, 2)
  cess            Decimal    @db.Decimal(14, 2)
  totalAmount     Decimal    @db.Decimal(14, 2)

  @@unique([creditNoteId, lineNumber])
}
```

Decisions

- **`customerId` is required**, unlike `salesInvoiceId` (optional) — a Credit Note
  always adjusts a specific customer's liability, but need not reference one particular
  invoice (a discount can cover an account's overall history). When `salesInvoiceId` is
  set, `customerId` must match that invoice's own customer (validated server-side), and
  the referenced invoice's `status` must be `POSTED` — a `DRAFT` invoice has no committed
  financial effect yet to adjust, and a `CANCELLED` invoice's effect has already been
  reversed, so linking either is rejected as a friendly validation error, not silently
  allowed. A `WALK_IN`-mode invoice has no customer to link a Credit Note's `customerId`
  to, so Credit Notes referencing a `WALK_IN` invoice are rejected (use `CASH_REFUND` on a
  Sales Return instead — spec 39).
- **Line shape is freeform** (`description` + `taxableAmount` + `ratePercent`/
  `cessPercent` entered or picked directly from a `GstRate`), not derived from a product
  or invoice line — deliberately looser than Sales Return's product-anchored lines,
  since a Credit Note's whole purpose is adjustments that don't map cleanly onto "N units
  of product X" (a lump-sum discount, a rate dispute settled at a negotiated figure).
- **`refundMode`/`refundLedgerId`** — reuses `39-sales-return.md`'s `RefundMode` enum and
  the identical conditional-`refundLedgerId` validation rule, for the same reason (a
  Credit Note may reduce the customer's ledger balance or trigger an actual cash
  refund).
- **`reason`** — required (unlike Sales Return's optional `reason`), since a Credit Note
  with no linked invoice has no other context explaining why it exists.
- No `branchId`, same posture as every spec in this phase.

---

# Business Rules

- **Editable while `DRAFT`.** Posting freezes the document.
- **Posting (`postCreditNote`, one transaction)**:
  1. If `salesInvoiceId` is set, re-verify (against current state, not the state when
     this note was drafted) that the invoice's `status` is still `POSTED` and its
     customer still matches this note's `customerId` — reject otherwise, since the
     invoice may have been cancelled, or a mismatch introduced, since this note was
     created as a `DRAFT`.
  2. Recompute each line's tax via `gstEngine.calculateLine` (using this note's own
     `placeOfSupplyStateCode` → `determineSupplyType`, since a Credit Note with no
     linked invoice has no invoice-level supply type to inherit; when
     `salesInvoiceId` is set, default this field from that invoice's own
     `placeOfSupplyStateCode` but still allow override — a post-sale adjustment can
     legitimately use a different place of supply than the original sale in edge cases,
     though this is rare).
  3. Generate `noteNumber` (`DocumentType.CREDIT_NOTE`, spec 34's two-step contract).
  4. Build the balanced voucher (see Ledger Posting) and call `voucherEngine.postVoucher`
     (`VoucherType.CREDIT_NOTE`).
  5. Set `status = POSTED`, `voucherId`. **No Inventory Engine call ever.**
- **Ledger Posting**: **Debit** `CompanySettings.salesLedgerId` for `taxableAmount` and
  the applicable output-tax ledgers for their totals (reusing spec 38's mapping and its
  missing-mapping rejection). **Credit** the customer's Ledger (`LEDGER_ADJUSTMENT`) or
  `refundLedgerId` (`CASH_REFUND`) for `grandTotal`.
- **Cancellation**: `cancelCreditNote(id)` — only a `POSTED` note; calls
  `voucherEngine.cancelVoucher` (mirrored reversal, no stock involved). Sets
  `status = CANCELLED`.
- **Company-scoped for every user**, identical posture to specs 35–39.

---

# Service / Repository

Create

```text
src/modules/credit-notes/repositories/credit-note-repository.ts
src/modules/credit-notes/services/credit-note-service.ts
src/modules/credit-notes/validation/credit-note-schema.ts
src/modules/credit-notes/actions/credit-note-actions.ts
src/modules/credit-notes/components/…
src/types/credit-note.ts
```

- `creditNoteService`: `listCreditNotes(filters)`, `getCreditNote(id)`,
  `createDraft(input)`, `updateDraft(id, input)` (only while `DRAFT`),
  `postCreditNote(id)`, `cancelCreditNote(id)`.

---

# Validation

Zod (`credit-note-schema.ts`): `customerId` uuid, `salesInvoiceId` optional uuid (server
verifies the customer match and that the invoice's `status` is `POSTED` when present),
`placeOfSupplyStateCode` against
`GST_STATE_CODES`, `noteDate` calendar date, `reason` required non-empty ≤ 500,
`refundMode`/`refundLedgerId` refine identical to spec 39, lines array ≥ 1
(`description` non-empty ≤ 200, `taxableAmount` > 0 ≤ 2 decimals, `ratePercent` 0–100 ≤ 2
decimals, `cessPercent` 0–100 ≤ 2 decimals).

---

# UI

Pages (under the `/sales` hub)

- `/sales/credit-notes` — Credit Note list (Number, Customer, Linked Invoice (if any),
  Date, Grand Total, Status, Actions) with search + status/customer filters
- `/sales/credit-notes/new` — Create Credit Note (optional invoice picker to prefill
  customer/place-of-supply; freeform line editor)
- `/sales/credit-notes/[id]` — View Credit Note (read-only detail, status actions: Post /
  Cancel)
- `/sales/credit-notes/[id]/edit` — Edit Credit Note (only reachable while `DRAFT`)

Components (`src/modules/credit-notes/components/`): Credit Note Table (+ filter bar),
Credit Note Form (optional invoice picker, freeform adjustment-line editor, refund-mode
toggle reused from Sales Return's component where practical), Credit Note Status Badge.

Wire-up

- Add a "Credit Notes" card to the `/sales` hub page.
- Add `credit-notes: "Credit Notes"` to `src/constants/breadcrumbs.ts`.

---

# Security

Gated by the `sales` permission module: `view`, `create`, `edit` (update while `DRAFT`),
`approve` used by Post (every Credit Note post requires it — the same unconditional
posture as Sales Return's Post, since it always reduces recognized revenue), `delete` not
implemented. Company-scoped identically to specs 35–39.

---

# Database

New enum `CreditNoteStatus`; new models `CreditNote`, `CreditNoteItem` (reuses spec 39's
`RefundMode` enum, no new one). One migration. Back-relations on `Company`,
`FinancialYear`, `Customer`, `SalesInvoice`, `Voucher`, `Ledger`, `User`. No seeding.

---

# Code Standards

Same as specs 38–39: strict TypeScript, no `any`, no arithmetic outside its owning
engine, transactional posting/cancellation, vitest coverage for: the customer/invoice
mismatch rejection, the `WALK_IN`-invoice rejection, ledger-posting balance across both
refund modes, cancellation's mirrored reversal, numbering uniqueness, missing-ledger-
mapping rejection.

---

# Do Not

Do not implement

- Any stock movement (Sales Return, spec 39, owns that)
- Sales Return or Debit Note (specs 39, 41)
- Auto-generation from a Sales Return (optional/manual linkage only, via
  `salesInvoiceId` context — no automatic trigger)
- Printing, PDF generation, or WhatsApp sharing (deferred identically to specs 35–39)

---

# Success Criteria

Verify

- Posting a Credit Note (with and without a linked Sales Invoice) produces a balanced
  `VoucherType.CREDIT_NOTE` voucher and **no** `StockTransaction` row (grep confirms no
  Inventory Engine import in this module).
- A Credit Note referencing a `WALK_IN`-mode invoice is rejected; a customer/invoice
  mismatch is rejected; a Credit Note referencing a `DRAFT` or `CANCELLED` invoice is
  rejected, both at draft-creation time and re-checked at posting time.
- Cancelling a posted Credit Note produces a correct mirrored voucher reversal.
- `npx tsc --noEmit`, `npx eslint src prisma`, `npx vitest run`, and `next build` all
  pass; `/sales/credit-notes*` appears in the build route table.

Feature-spec 40 (this spec) is `context/Phases/phase-tracker.md`'s Phase 3 item #38.
