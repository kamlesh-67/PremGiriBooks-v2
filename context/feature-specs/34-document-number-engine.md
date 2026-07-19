# 34 - Document Number Engine

> Feature-spec file number 34 (spec-file numbers are sequential and never reused). This
> feature is `context/Phases/phase-tracker.md`'s Phase 2 — Core Business Foundation →
> **Shared ERP Engines** item **#32 Document Number Engine**. The tracker lists it last
> in the group, but **implement it first among the engines**: the Voucher Engine (spec
> 31) calls it at posting time, and nothing here depends on any other engine. Tracker
> dependencies: Company + Financial Year (both implemented). The Branch dimension is
> deliberately excluded — Branch Management (spec 12) remains unimplemented — and the
> tracker's dependency entry reflects that (see Data Model for the forward-note).

## Goal

Implement the **Document Number Engine** for **Premgiri Books ERP** — the single owner
of sequential document numbering that every numbered document consumes: vouchers (spec
31), Quotations (#33), Sales Orders (#34), Sales Invoices (#36), Purchase Orders (#40),
GRNs (#41), Purchase Invoices (#42), returns and notes.

Numbering rules this engine encodes:

- Sequences are **per company, per financial year, per document type** — Indian
  practice (and GST expectation) is that document series restart each financial year.
- Numbers are **strictly increasing and never reused**: the engine never decrements or
  reissues a number. Gaps are legal and unmanaged — a committed-then-cancelled document
  leaves one (cancellation is recorded, not renumbered), while a rolled-back
  transaction consumes nothing (see the next invariant). No renumbering API may exist.
- Generation is **concurrency-safe inside the caller's transaction** — two documents
  posted simultaneously must never receive the same number, and a rolled-back document
  posting rolls its number back with it (the gap then never materializes).

It also ships the one small user-facing surface of the engines group: a settings screen
for per-type prefix/padding.

---

# Project Context

Before implementation, review

- PRD.md, architecture-context.md (Document Driven), code-standards.md,
  ai-workflow-rules.md, progress-tracker.md
- `context/Phases/phase-tracker.md` (Shared ERP Engines; every Phase 3–6 document that
  consumes this)
- `09-financial-year.md` (the FY scoping and closed-year semantics)
- `31-voucher-engine.md` (the first consumer — its posting transaction calls
  `generateNumber` with a passed `tx`)
- `30-pricing-engine.md` (standing engine conventions: `src/engines/` placement,
  caller-supplied `companyId`, repository-owned Prisma access)
- `25-product-management.md` (the "no auto-numbering until the Document Number Engine"
  deferrals this engine now resolves — note: product codes stay manual; this engine
  numbers *documents*, not masters)

---

# Module Responsibilities

The Document Number Engine is responsible for

- The `DocumentSequence` schema — one row per (company, financial year, document type)
- `generateNumber` — atomic, transaction-participating next-number generation with
  formatting
- `previewNextNumber` — non-consuming read for form display ("next number will be…")
- The Document Numbering settings screen (per-type prefix/padding per company)

The Document Number Engine is **not** responsible for

- Uniqueness of numbers *on documents* (each document table carries its own unique
  constraint, as `Voucher` already specifies — the engine's atomicity makes collisions
  unreachable, the document constraint makes them impossible)
- Master-data codes (`productCode` etc. stay user-entered)
- Branch-wise series (excluded — see Data Model)
- Cancellation, gap tracking, or renumbering (gaps are legal and unmanaged)

---

# Data Model

Add to `prisma/schema.prisma` (plus back-relations on `Company` and `FinancialYear`):

```text
enum DocumentType {
  QUOTATION
  SALES_ORDER
  DELIVERY_CHALLAN
  SALES_INVOICE
  SALES_RETURN
  CREDIT_NOTE
  DEBIT_NOTE
  PURCHASE_ORDER
  GOODS_RECEIPT_NOTE
  PURCHASE_INVOICE
  PURCHASE_RETURN
  PAYMENT_VOUCHER
  RECEIPT_VOUCHER
  CONTRA_VOUCHER
  JOURNAL_VOUCHER
  SALES_VOUCHER
  PURCHASE_VOUCHER
  CREDIT_NOTE_VOUCHER
  DEBIT_NOTE_VOUCHER
  SALES_RETURN_VOUCHER
  PURCHASE_RETURN_VOUCHER
  STOCK_ADJUSTMENT
  STOCK_TRANSFER
}

model DocumentSequence {
  id              String        @id @default(uuid())
  companyId       String
  company         Company       @relation(fields: [companyId], references: [id])
  financialYearId String
  financialYear   FinancialYear @relation(fields: [financialYearId], references: [id])
  documentType    DocumentType
  prefix          String
  padding         Int           @default(4)
  nextNumber      Int           @default(1)
  createdAt       DateTime      @default(now())
  updatedAt       DateTime      @updatedAt

  @@unique([companyId, financialYearId, documentType])
  @@index([companyId])
}
```

Decisions

- `DocumentType` — forward-declarative enum covering every numbered document on the
  phase tracker (the `DEFAULT_ROLE_PERMISSIONS` precedent: a catalog for modules that
  don't exist yet is fine when the catalog is the engine's contract). **Every one of
  spec 31's ten `VoucherType`s maps 1:1 to its own dedicated `*_VOUCHER` entry**
  (`PAYMENT → PAYMENT_VOUCHER`, …, `SALES → SALES_VOUCHER`, `PURCHASE →
  PURCHASE_VOUCHER`, `CREDIT_NOTE → CREDIT_NOTE_VOUCHER`, etc.; spec 31's
  `postVoucher` owns the mapping) — so the voucher a Sales Invoice generates numbers
  from `SALES_VOUCHER`, a series distinct from the invoice document's own
  `SALES_INVOICE` series. One series per thing that displays a number; a document and
  the voucher it generates are two numbered things.
- **No `branchId`** — Branch Management (spec 12) is unimplemented, and a nullable
  column inside a composite unique creates the Postgres NULLs-are-distinct trap
  (multiple "no branch" rows). When branches land and a real requirement for
  branch-wise series exists, a migration adds the dimension deliberately. Recorded
  forward-note; same posture as spec 31.
- **Lazy row creation**: the first use of a (company, FY, type) creates the row with
  defaults via `ensureSequence` (see Business Rules — it runs in its own standalone
  transaction, before any posting transaction) — no bootstrap/TenantBootstrapService
  change, no backfill for existing companies, no seeding. Default prefix per type from a constant
  map (e.g. `SALES_INVOICE → "INV"`, `QUOTATION → "QTN"`, `PAYMENT_VOUCHER → "PMT"` — 
  full map defined in code, editable per company on the settings screen).
- **Format**: `{prefix}-{paddedNumber}` (e.g. `INV-0001`; number exceeds padding →
  grows naturally, `INV-10000`). The FY is *not* embedded in the number by default —
  the series already restarts per FY, and GST's 16-character invoice-number limit
  makes short numbers safer. Companies wanting `INV/25-26/` style encode it in the
  prefix themselves.
- `prefix` ≤ 10 chars, `padding` 1–8, and combined `prefix.length + 1 + padding ≤ 16`
  (object-level refine) so every formatted number fits GST's 16-character
  document-number limit at its configured width. **The 16-character guard applies to
  the configured width only, by explicit choice**: a series that overflows its pad
  width (number > 10^padding − 1) keeps growing naturally and the engine imposes **no
  width-based cap, truncation, or failure** — a numbering engine must never refuse to
  number a legal document over formatting. Sizing `padding` to expected annual volume
  is the operator's job (which is why it is configurable per type); the settings
  screen may warn when a sequence approaches its configured width, but generation
  never blocks on width. (The numeric domain itself does have a documented bound —
  next bullet.)
- **`nextNumber` overflow policy**: `Int` maps to Postgres 32-bit `INTEGER`, so each
  (company, FY, type) sequence has a **deliberate, documented backend maximum of
  2,147,483,647**. This is unreachable in practice — sequences reset every financial
  year, and exhausting the range would take ~68 documents *per second, sustained for
  the entire year, in one series* — so widening to `BigInt` end-to-end (JS `BigInt`
  friction through every consumer and formatted string) was considered and rejected.
  At the boundary the behavior is defined, not accidental: `generateNumber` rejects
  with a clear `AppError` when the sequence has reached the maximum (checked at the
  increment — never a silent wraparound or a raw Postgres overflow error surfacing to
  a caller). This numeric bound is the one exception to the no-cap rule above, which
  governs formatting width only.

---

# Business Rules

- **`generateNumber(tx, {companyId, financialYearId, documentType})`** must be called
  with the caller's open transaction client and is atomic within it. Two-step design,
  split so no error path can poison the caller's transaction:
  1. **`ensureSequence(companyId, financialYearId, documentType)` runs *outside* and
     *before* the posting transaction**, in its own short standalone transaction: an
     idempotent create-if-missing of the sequence row with the type's defaults. A
     concurrent first-use race surfaces as `P2002` there — caught and resolved by
     re-reading, bounded retry — harmlessly, because nothing else shares that
     transaction. This split exists because Postgres aborts the entire open
     transaction on any statement error: catching `P2002` and "continuing" inside the
     caller's interactive posting transaction is **not possible without savepoints and
     must not be attempted**. Callers ensure the sequence, then open the posting
     transaction.
  2. Inside the caller's transaction, `generateNumber` performs **only** the atomic
     `update … { nextNumber: { increment: 1 } }` on the unique triple, computing the
     assigned number from the returned row (`nextNumber − 1`). Concurrent increments
     serialize on the row lock with no error path; a missing row here is a contract
     violation (caller skipped `ensureSequence`) surfaced as a clear error; if the
     posting transaction later aborts, the increment rolls back with it.
  This is exactly the atomicity the Voucher Engine's "no duplicate numbers under
  concurrency" success criterion exercises.
- Rollback safety: because the increment lives in the caller's transaction, an aborted
  document posting also aborts the increment — numbers are only consumed by committed
  documents.
- The financial year must belong to the company and **not be closed** (numbering into a
  closed year is posting into a closed year — reject with a friendly error; the same
  rule spec 31 enforces independently).
- Settings edits (prefix/padding) apply to numbers generated **after** the change;
  already-issued numbers are never rewritten. Changing a prefix mid-year is allowed
  and **cannot collide within the sequence**: the numeric suffix is monotonic per
  (company, FY, type), so two formatted numbers from one sequence always differ in
  their numeric part regardless of prefix history. Identical formatted strings are
  possible only *across document types* (two types configured with the same prefix) —
  legal by design, because **the uniqueness scope is per (company, financial year,
  document type)**: every document table's unique constraint includes its type
  dimension (as `Voucher`'s `(companyId, financialYearId, voucherType,
  voucherNumber)` already does — the standing pattern future document tables follow),
  never the bare formatted string.
- `nextNumber` is monotonically increasing: no API decrements, resets, or renumbers.
- `previewNextNumber` reads without incrementing (form display only — the displayed
  number is advisory; the posted number is whatever generation returns inside the
  posting transaction).
- **Company-scoped** via caller-supplied `companyId` (engine convention); the settings
  screen scopes via `getCurrentCompanyUser()` like every module.

---

# Structure

Create

```text
src/engines/document-number/document-number-engine.ts // ensureSequence, generateNumber, previewNextNumber, formatNumber
src/engines/document-number/document-defaults.ts      // per-type default prefix map
src/engines/document-number/types.ts
src/modules/document-sequences/repositories/document-sequence-repository.ts
src/modules/document-sequences/services/document-sequence-service.ts   // settings screen backend
src/modules/document-sequences/validation/document-sequence-schema.ts
src/modules/document-sequences/actions/document-sequence-actions.ts
src/modules/document-sequences/components/…
```

- The engine exposes the generation API to other engines/modules; the small
  `document-sequences` module owns the settings surface (list + edit of per-type
  prefix/padding for the active company + current FY, lazily materializing rows).
  `formatNumber` is pure and unit-tested.
- Settings service methods: `listSequences()` (all `DocumentType`s with stored-or-
  default config + next number), `updateSequence(documentType, {prefix, padding})`.

---

# Validation

Zod: prefix required, trimmed, 1–10 chars, uppercase alphanumeric plus `/ -` (kept
printable and GST-safe); padding integer 1–8; object-level refine
`prefix.length + 1 + padding ≤ 16` (see Data Model). Engine input: uuids + enum.

---

# UI

One page: `/settings/document-numbering` — a table of document types (label, prefix,
padding, next number, edit action) for the active company and current financial year.
Editing uses a small inline form or dialog (implementer's choice, matching existing
settings-page conventions).

Wire-up: link/card on the existing `/settings` surface consistent with how existing
settings pages are reached; `"document-numbering": "Document Numbering"` in
`src/constants/breadcrumbs.ts`.

---

# Security

Settings screen gates via `assertPermission(user, "settings", "view" | "edit")` — the
`settings` module has existed in the Permission catalog since spec 11; no catalog
changes. The generation API performs no permission checks (engine convention — the
posting caller has already gated its own document permission). All reads/writes
company-scoped.

---

# Database

New model `DocumentSequence`, new enum `DocumentType`. One migration. Back-relations on
`Company` and `FinancialYear`. No seeding (lazy row creation).

---

# Code Standards

Strict TypeScript, no `any`, Repository → Service/Engine → Action → UI for the settings
surface, atomic-increment generation (never read-then-write without the increment
guard), vitest as a primary deliverable:

- format matrix (padding growth past the pad width, prefix variants, bounds)
- atomic generation under concurrency (parallel `generateNumber` calls on one triple
  yield strictly distinct consecutive numbers; first-use creation race resolves via the
  documented retry)
- rollback: an aborted transaction consumes no number
- numeric boundary: a sequence preset at the documented `Int` maximum rejects with the
  defined `AppError` (no wraparound, no raw driver error)
- closed-FY and cross-company rejection
- settings edits affect subsequent numbers only

---

# Do Not

Do not implement

- Branch-wise series (forward-noted migration when spec 12 lands)
- Number embedding of FY/branch/date tokens or a template mini-language (prefix +
  padding only; revisit if a real requirement arrives)
- Renumbering, gap-filling, number reservation, or cancellation handling
- Master-data code generation (product codes etc. stay manual)
- Per-user or per-terminal series
- Any document table or document UI (consumers come in Phases 3–6)
- Backfill/bootstrap seeding of sequence rows

---

# Success Criteria

Verify

- `generateNumber` issues strictly increasing, gap-free-under-success numbers per
  (company, FY, type); parallel generation produces no duplicates (test exercises the
  race); aborted transactions consume nothing.
- First use lazily creates the sequence with the type's default prefix; the settings
  screen lists all types, edits round-trip, and edited config applies only forward.
- Closed-FY generation and cross-company access are rejected friendly; settings screen
  is permission-gated and company-scoped.
- Formatting matches the documented shape and grows naturally past the pad width; the
  prefix (≤ 10) + padding (≤ 8) bounds are pinned by schema tests, keeping default
  configurations within GST's 16-character document-number limit.
- `npx tsc --noEmit`, `npx eslint src prisma`, `npx vitest run`, and `next build` all
  pass.

Completing this spec (together with specs 31–33) completes
`context/Phases/phase-tracker.md`'s Phase 2 **Shared ERP Engines** group — and with the
Pricing group (specs 28–30) and Business Parties (specs 26–27), all of Phase 2. Phase 3
(Sales Management) follows.
