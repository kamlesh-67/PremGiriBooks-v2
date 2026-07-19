# 41 - Debit Note

> Feature-spec file number 41. This feature is `context/Phases/phases.md`'s **Phase 3 —
> Sales Management** and `context/Phases/phase-tracker.md`'s Phase 3 item **#39 Debit
> Note** — the last item in Phase 3. Depends on Sales Invoice (feature-spec 38). Seventh
> and last of the seven Phase 3 documents; a near-mirror of `40-credit-note.md` with the
> ledger direction reversed. Read that spec first — this one records only what differs.

## Goal

Implement **Debit Note** for **Premgiri Books ERP** — the mirror of Credit Note (feature-
spec 40): a **pure financial adjustment** that **increases** what a customer owes, with
**no stock movement**. Covers under-billing correction, additional post-invoice charges,
or interest/late-fee assessment — never a substitute for a Sales Invoice (a new sale still
requires a proper invoice, per code-standards.md's Voucher Driven principle).

`VoucherType.DEBIT_NOTE` already exists (spec 31) with no other consumer — this document
is what it was reserved for. This spec completes Phase 3 (Sales Management).

---

# Project Context

Before implementation, review

- `40-credit-note.md` (**read this first in full** — this spec differs only in ledger
  direction and the absence of a refund concept; everything else — data model shape,
  business-rule structure, service/UI conventions — is identical and not re-explained
  here)
- `39-sales-return.md` (the three-way scope boundary between Sales Return, Credit Note,
  and this spec)
- `38-sales-invoice.md` (the Company Settings ledger mapping this spec reuses)
- `31-voucher-engine.md` (`VoucherType.DEBIT_NOTE`)
- `34-document-number-engine.md` (`DocumentType.DEBIT_NOTE`)

---

# Module Responsibilities

Identical to `40-credit-note.md`'s, with "Debit Note" substituted for "Credit Note"
throughout, and **no refund-mode concept** (see Data Model — a Debit Note only ever
increases a customer's ledger balance; there is no "refund" direction to choose between).

---

# Data Model

Add to `prisma/schema.prisma` (plus `debitNotes DebitNote[]` back-relations on
`Company`, `FinancialYear`, `Customer`, `SalesInvoice`, `User`):

```text
enum DebitNoteStatus {
  DRAFT
  POSTED
  CANCELLED
}

model DebitNote {
  id              String          @id @default(uuid())
  companyId       String
  company         Company         @relation(fields: [companyId], references: [id])
  financialYearId String
  financialYear   FinancialYear   @relation(fields: [financialYearId], references: [id])
  noteNumber      String
  noteDate        DateTime        @db.Date
  customerId      String
  customer        Customer        @relation(fields: [customerId], references: [id])
  salesInvoiceId  String?
  salesInvoice    SalesInvoice?   @relation(fields: [salesInvoiceId], references: [id])
  placeOfSupplyStateCode String
  status          DebitNoteStatus @default(DRAFT)
  reason          String
  taxableAmount   Decimal         @db.Decimal(14, 2)
  totalCgst       Decimal         @db.Decimal(14, 2)
  totalSgst       Decimal         @db.Decimal(14, 2)
  totalIgst       Decimal         @db.Decimal(14, 2)
  totalCess       Decimal         @db.Decimal(14, 2)
  grandTotal      Decimal         @db.Decimal(14, 2)
  voucherId       String?         @unique
  voucher         Voucher?        @relation(fields: [voucherId], references: [id])
  createdByUserId String?
  createdBy       User?           @relation(fields: [createdByUserId], references: [id])
  createdAt       DateTime        @default(now())
  updatedAt       DateTime        @updatedAt

  items DebitNoteItem[]

  @@unique([companyId, financialYearId, noteNumber])
  @@index([companyId, customerId])
  @@index([companyId, status])
}

model DebitNoteItem {
  id            String    @id @default(uuid())
  debitNoteId   String
  debitNote     DebitNote @relation(fields: [debitNoteId], references: [id])
  lineNumber    Int
  description   String
  taxableAmount Decimal   @db.Decimal(14, 2)
  ratePercent   Decimal   @db.Decimal(5, 2)
  cessPercent   Decimal   @db.Decimal(5, 2) @default(0)
  cgst          Decimal   @db.Decimal(14, 2)
  sgst          Decimal   @db.Decimal(14, 2)
  igst          Decimal   @db.Decimal(14, 2)
  cess          Decimal   @db.Decimal(14, 2)
  totalAmount   Decimal   @db.Decimal(14, 2)

  @@unique([debitNoteId, lineNumber])
}
```

Decisions (differences from `40-credit-note.md` only)

- **No `refundMode`/`refundLedgerId`** — a Debit Note only ever increases the customer's
  ledger balance; there is no cash-leaving-the-business direction to model. A `WALK_IN`-
  mode source invoice is rejected identically to Credit Note's rule (no ledger exists to
  debit further), for the same reason.
- Every other column mirrors `40-credit-note.md`'s `CreditNote`/`CreditNoteItem` shape
  exactly (same `customerId`-required/`salesInvoiceId`-optional posture, same freeform
  line shape, same `createdByUserId`/no-`branchId` conventions).

---

# Business Rules

Identical structure to `40-credit-note.md`'s, with the ledger direction reversed:

- Editable while `DRAFT`; posting freezes the document.
- **Posting (`postDebitNote`, one transaction)**: recompute each line's tax via
  `gstEngine.calculateLine` (same `placeOfSupplyStateCode` sourcing rule as Credit
  Note), generate `noteNumber` (`DocumentType.DEBIT_NOTE`), build the balanced voucher,
  call `voucherEngine.postVoucher` (`VoucherType.DEBIT_NOTE`), set `status = POSTED` +
  `voucherId`. **No Inventory Engine call ever.**
- **Ledger Posting** (the reversal of Credit Note's): **Debit** the customer's Ledger for
  `grandTotal`. **Credit** `CompanySettings.salesLedgerId` for `taxableAmount` and the
  applicable output-tax ledgers for their totals (same six-field mapping and missing-
  mapping rejection as spec 38/40).
- **Cancellation**: `cancelDebitNote(id)` — only a `POSTED` note; mirrors
  `voucherEngine.cancelVoucher`. Sets `status = CANCELLED`.
- A `WALK_IN`-mode source invoice's `customerId` cannot be linked (rejected, identical
  reasoning to Credit Note).
- Company-scoped for every user, identical posture to specs 35–40.

---

# Service / Repository

Create

```text
src/modules/debit-notes/repositories/debit-note-repository.ts
src/modules/debit-notes/services/debit-note-service.ts
src/modules/debit-notes/validation/debit-note-schema.ts
src/modules/debit-notes/actions/debit-note-actions.ts
src/modules/debit-notes/components/…
src/types/debit-note.ts
```

- `debitNoteService`: `listDebitNotes(filters)`, `getDebitNote(id)`, `createDraft(input)`,
  `updateDraft(id, input)` (only while `DRAFT`), `postDebitNote(id)`,
  `cancelDebitNote(id)` — the exact method set of `creditNoteService`, minus any
  refund-mode parameter.

---

# Validation

Zod (`debit-note-schema.ts`) — identical to `credit-note-schema.ts` minus the
`refundMode`/`refundLedgerId` fields entirely.

---

# UI

Pages (under the `/sales` hub)

- `/sales/debit-notes` — Debit Note list (Number, Customer, Linked Invoice (if any),
  Date, Grand Total, Status, Actions) with search + status/customer filters
- `/sales/debit-notes/new` — Create Debit Note
- `/sales/debit-notes/[id]` — View Debit Note (read-only detail, status actions: Post /
  Cancel)
- `/sales/debit-notes/[id]/edit` — Edit Debit Note (only reachable while `DRAFT`)

Components (`src/modules/debit-notes/components/`): Debit Note Table (+ filter bar),
Debit Note Form (optional invoice picker, freeform adjustment-line editor — no refund-
mode toggle), Debit Note Status Badge.

Wire-up

- Add a "Debit Notes" card to the `/sales` hub page — **this is the seventh and final
  card**, completing the `/sales` hub started in `35-quotations.md`.
- Add `debit-notes: "Debit Notes"` to `src/constants/breadcrumbs.ts`.

---

# Security

Gated by the `sales` permission module: `view`, `create`, `edit` (update while `DRAFT`),
`approve` used by Post (every Debit Note post requires it, same unconditional posture as
Credit Note's Post — it increases what a customer owes, a decision worth the same gate),
`delete` not implemented. Company-scoped identically to specs 35–40.

---

# Database

New enum `DebitNoteStatus`; new models `DebitNote`, `DebitNoteItem`. One migration.
Back-relations on `Company`, `FinancialYear`, `Customer`, `SalesInvoice`, `Voucher`,
`User`. No seeding.

---

# Code Standards

Same as spec 40: strict TypeScript, no `any`, no arithmetic outside its owning engine,
transactional posting/cancellation, vitest coverage for: the `WALK_IN`-invoice rejection,
customer/invoice mismatch rejection, ledger-posting balance (reversed direction from
Credit Note — assert this explicitly in a test, not just by symmetry with spec 40's
suite), cancellation's mirrored reversal, numbering uniqueness, missing-ledger-mapping
rejection.

---

# Do Not

Do not implement

- Any stock movement, refund-mode concept, or cash-leaving-the-business flow (a Debit
  Note only ever increases what's owed)
- Sales Return or Credit Note (specs 39, 40)
- Auto-generation from any other document
- Printing, PDF generation, or WhatsApp sharing (deferred identically to specs 35–40 —
  and, since this is the last Phase 3 spec, the point at which a dedicated future
  printing/PDF/WhatsApp feature-spec should finally be scoped, covering all seven
  document types at once)

---

# Success Criteria

Verify

- Posting a Debit Note produces a balanced `VoucherType.DEBIT_NOTE` voucher with the
  ledger direction reversed from Credit Note (Debit customer, Credit Sales/Output-tax)
  and **no** `StockTransaction` row.
- A Debit Note referencing a `WALK_IN`-mode invoice is rejected; a customer/invoice
  mismatch is rejected.
- Cancelling a posted Debit Note produces a correct mirrored voucher reversal.
- `npx tsc --noEmit`, `npx eslint src prisma`, `npx vitest run`, and `next build` all
  pass; `/sales/debit-notes*` appears in the build route table.

Feature-spec 41 (this spec) is `context/Phases/phase-tracker.md`'s Phase 3 item #39 —
**the last item in Phase 3 (Sales Management)**. Per `phases.md`, Phase 4 (Purchase
Management, #40–#43) is next.
