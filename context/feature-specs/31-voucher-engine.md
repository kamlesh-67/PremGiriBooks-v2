# 31 - Voucher Engine

> Feature-spec file number 31 (spec-file numbers are sequential and never reused). This
> feature is `context/Phases/phase-tracker.md`'s Phase 2 — Core Business Foundation →
> **Shared ERP Engines** item **#29 Voucher Engine**. Depends on Ledger Master
> (feature-spec 14, implemented) **and, for voucher numbering, on the Document Number
> Engine (tracker #32, feature-spec 34)** — the tracker lists #32 last, but nothing
> depends on implementing the engines in tracker order. **Recommended implementation
> order within the Shared ERP Engines group: #32 (spec 34) first, then this spec;
> #30 (spec 32) and #31 (spec 33) are independent and can land in any order.**

## Goal

Implement the **Voucher Engine** for **Premgiri Books ERP** — the double-entry accounting
core (`architecture-context.md` Core Engines; Invariants 1, 2, 9; code-standards.md
Financial Rules) that every future financial feature posts through: Sales Invoice (#36),
Purchase Invoice (#42), Payment/Receipt/Contra/Journal Vouchers (#50–#53), returns and
notes (#37–#39, #43), and that every financial report derives from (Trial Balance #61,
P&L #62, Balance Sheet #63).

The engine is a **service, not a screen** (the spec-30 engine convention): it exposes
posting, cancellation, and balance/aggregation query APIs plus the voucher schema.
**No transactional UI ships in this task** — nothing exists yet that creates vouchers.
Voucher entry screens are Phase 6 (#50–#53); report screens are Phase 9.

Financial data is immutable (code-standards.md): **posted vouchers are never edited and
never deleted; cancellation creates a reversal**. This engine is where that rule becomes
structural.

---

# Project Context

Before implementation, review

- PRD.md, architecture-context.md (Voucher Driven, Document Driven, Core Engines →
  Voucher Engine, Invariants 1–9), code-standards.md (Financial Rules — the exact rules
  this engine enforces), ai-workflow-rules.md, progress-tracker.md
- `context/Phases/phase-tracker.md` (Shared ERP Engines; the Accounting #50–#53, Sales
  #36, Purchase #42, and Reporting #61–#64 features that consume this engine)
- `14-ledger-master.md` (the `Ledger` model entries post to; `openingBalance` semantics)
- `09-financial-year.md` (FY date-range and closed-year semantics vouchers validate
  against)
- `34-document-number-engine.md` (voucher-number generation — implement it first)
- `30-pricing-engine.md` (the standing engine conventions this spec reuses: `src/engines/`
  placement, no permission checks inside the engine, explicit `companyId` from an
  authorized caller, pure-core + thin-loader structure where applicable)

---

# Module Responsibilities

The Voucher Engine is responsible for

- The `Voucher` / `VoucherEntry` schema — the single place ledger postings exist
- `postVoucher` — validated, balanced, atomic voucher creation
- `cancelVoucher` — reversal-based cancellation (never mutation)
- Balance and aggregation queries: ledger closing balance, ledger statement (the Cash
  Book / Bank Book primitive), and trial-balance aggregation (the data primitive Reports
  #61–#63 will render)

The Voucher Engine is **not** responsible for

- Any UI (voucher entry screens are #50–#53; Ledger Inquiry is the Accounting module;
  report screens are Phase 9)
- Deciding *which* entries a business document produces (Sales Invoice #36 knows its
  debit-customer/credit-sales/credit-GST breakup and passes finished entry lines here)
- GST calculation (GST Engine), stock (Inventory Engine), document numbering beyond
  *calling* the Document Number Engine
- Updating any stored balance — **no balance column exists anywhere**; balances are
  always computed from `Ledger.openingBalance` + entries (code-standards.md: "Ledger
  balances are never manually updated"; "Current stock/balance is calculated from
  transactions")

---

# Data Model

Add to `prisma/schema.prisma` (plus back-relations: `vouchers Voucher[]` on `Company` and
`FinancialYear`; `voucherEntries VoucherEntry[]` on `Ledger`; `vouchers Voucher[]` /
`voucherEntries` are **not** added to `Branch` — see decisions):

```text
enum VoucherType {
  PAYMENT
  RECEIPT
  CONTRA
  JOURNAL
  SALES
  PURCHASE
  CREDIT_NOTE
  DEBIT_NOTE
  SALES_RETURN
  PURCHASE_RETURN
}

enum VoucherStatus {
  POSTED
  CANCELLED
}

model Voucher {
  id              String        @id @default(uuid())
  companyId       String
  company         Company       @relation(fields: [companyId], references: [id])
  financialYearId String
  financialYear   FinancialYear @relation(fields: [financialYearId], references: [id])
  voucherType     VoucherType
  voucherNumber   String
  voucherDate     DateTime      @db.Date
  status          VoucherStatus @default(POSTED)
  narration       String?
  referenceType   String?
  referenceId     String?
  totalAmount     Decimal       @db.Decimal(14, 2)
  reversalOfId    String?       @unique
  reversalOf      Voucher?      @relation("VoucherReversal", fields: [reversalOfId], references: [id])
  reversedBy      Voucher?      @relation("VoucherReversal")
  createdByUserId String?
  createdBy       User?         @relation(fields: [createdByUserId], references: [id])
  createdAt       DateTime      @default(now())
  updatedAt       DateTime      @updatedAt

  entries VoucherEntry[]

  @@unique([companyId, financialYearId, voucherType, voucherNumber])
  @@index([companyId, voucherDate])
  @@index([companyId, voucherType])
  @@index([referenceType, referenceId])
}

model VoucherEntry {
  id        String      @id @default(uuid())
  voucherId String
  voucher   Voucher     @relation(fields: [voucherId], references: [id])
  ledgerId  String
  ledger    Ledger      @relation(fields: [ledgerId], references: [id])
  entryType BalanceType // DEBIT | CREDIT — reuses 14-ledger-master.md's enum
  amount    Decimal     @db.Decimal(14, 2)
  lineNumber Int

  @@unique([voucherId, lineNumber])
  @@index([ledgerId])
  @@index([voucherId])
}
```

Decisions

- **No draft status.** The Document-Driven lifecycle (Draft → … → Posted) belongs to
  business *documents*; a voucher is *born at posting* (the "Voucher Generated" step) —
  `POSTED` and `CANCELLED` are its only states. Draft invoices exist later without any
  voucher rows at all.
- `voucherNumber` — generated by the Document Number Engine at post time, inside the
  posting transaction; unique per `(company, financialYear, voucherType)`. Never
  client-supplied.
- `referenceType`/`referenceId` — polymorphic link to the source document
  ("SALES_INVOICE", its id), no FK by design: voucher rows must outlive any referencing
  table's shape, and the source-document tables don't exist yet. Manual vouchers
  (#50–#53) leave both null. Indexed for "find the voucher for this document".
- `reversalOfId` — self-relation, `@unique` (a voucher is reversed at most once). The
  reversal voucher's entries mirror the original with DEBIT↔CREDIT swapped.
- `createdByUserId` — the first use of the shared-field convention's optional
  `createdBy` (`06-database-foundation.md`), justified here and only here by the
  engine's Audit Trail responsibility; nullable FK (Users are never hard-deleted in this
  codebase). Do **not** retrofit other tables (known gap #4 in
  `architecture-context.md` stays open).
- **No `branchId`** — Branch Management (spec 12) is still unimplemented; adding a
  nullable column nothing writes is dead data. When branches land, a migration adds it
  (recorded forward-note).
- `VoucherEntry` carries no `companyId` — reachable only through its voucher (the
  spec-29 `PriceListItem` reasoning); every query joins through `Voucher`.
- `totalAmount` = the sum of debit entries (== credit sum), denormalized for list
  rendering only — never used in balance computation (entries are the truth).

---

# Business Rules (enforced in `postVoucher`, all inside one transaction)

- **Balanced**: sum(DEBIT amounts) === sum(CREDIT amounts), compared in paise (integers,
  amount × 100) to avoid float drift; at least 2 entries; every amount > 0; every entry
  max 2 decimals.
- Every `ledgerId` belongs to the caller's company and is **active at posting time**.
- `financialYearId` belongs to the company, is **not closed**, and `voucherDate` falls
  inside the FY's inclusive date range (`09-financial-year.md` semantics).
- `voucherNumber` is generated via the Document Number Engine **inside the same
  transaction** (its atomic-increment contract, spec 34).
- **Immutable once posted**: the engine exposes no update API of any kind — no method
  updates a `Voucher` or `VoucherEntry` row except `cancelVoucher`'s status flip.
- **`cancelVoucher(id)`**: only a `POSTED`, not-already-reversed voucher; creates the
  reversal voucher (same type, same FY — with its own generated number, entries
  mirrored, `reversalOfId` set, narration "Reversal of {number}") and flips the original
  to `CANCELLED`, both in one transaction. Cancelling a reversal voucher is rejected.
  If the original's FY is closed, cancellation is rejected (post-closure corrections are
  a future Journal-in-open-FY concern, not silent back-dated edits).
- Balance queries: `closing = Ledger.openingBalance (signed by openingBalanceType) +
  Σ debits − Σ credits` for DEBIT-nature presentation (sign conventions follow the
  ledger group's `accountNature` for reporting; the engine returns raw debit/credit sums
  and a signed net so Reports choose presentation).
- **Company-scoped**: engine methods take `companyId` from their authorized caller
  (spec-30 convention) and re-verify every loaded row against it.

---

# Structure

Create

```text
src/engines/voucher/voucher-engine.ts     // postVoucher, cancelVoucher, getVoucher, listVouchers
src/engines/voucher/voucher-queries.ts    // getLedgerBalance, getLedgerStatement, getTrialBalance
src/engines/voucher/voucher-validation.ts // pure checks: balance, dates, line shape — fully unit-tested
src/engines/voucher/types.ts              // PostVoucherInput, entry line, query result types
src/modules/vouchers/repositories/voucher-repository.ts  // the only Prisma access
```

- Repository → Engine layering mirrors Repository → Service: all Prisma access in the
  repository; the engine owns the rules. Decimal → number normalization at the
  repository boundary (established convention).
- `postVoucher(input, tx?)` accepts an optional transaction client so a future document
  posting (invoice + voucher + stock + GST rows) can be one atomic transaction — design
  the repository methods to run on a passed `tx` (the `seedDefaultGroups(companyId, tx)`
  precedent).
- `getTrialBalance(companyId, financialYearId, asOfDate?)` returns per-ledger debit/
  credit totals + opening balances — aggregation via Prisma `groupBy` on entries. This
  is a data primitive; rendering is Reports #61.
- `getLedgerStatement(companyId, ledgerId, from, to)` returns dated entries with running
  balance — the Cash Book / Bank Book / Ledger Inquiry primitive.
- No Server Actions, no permission checks in the engine (spec-30 convention — callers
  gate). No pages, no cards, no breadcrumbs.

---

# Validation

Zod at the engine boundary (`voucher-validation.ts` shapes): voucher type enum, ISO
date, narration ≤ 500, entries array ≥ 2 with uuid ledger ids, positive 2-decimal
amounts, and the object-level balanced-sum refine (integer-paise comparison). Reference
type/id optional strings ≤ 50 / uuid.

---

# Security

No permission checks inside the engine (documented convention) — future consumers gate
(`accounting` for manual vouchers, `sales`/`purchase` for document postings). Every read
and write is company-scoped through the caller-supplied `companyId`. Voucher rows are
never exposed by any route in this task.

---

# Database

New models `Voucher`, `VoucherEntry`; new enums `VoucherType`, `VoucherStatus`
(`BalanceType` reused from spec 14). One migration. Back-relations on `Company`,
`FinancialYear`, `Ledger`, `User`. No seeding.

---

# Code Standards

Strict TypeScript, no `any`, pure validation core separated from I/O, integer-paise
arithmetic for balance comparison, transactions for every write (code-standards.md
Database Standards), vitest as a primary deliverable:

- balance matrix (balanced, off-by-one-paisa, single-entry, zero/negative amounts,
  3-decimal amounts)
- FY validation (date outside range, closed FY, cross-company FY)
- ledger validation (inactive, cross-company)
- cancellation (mirror entries, double-cancel rejected, cancelling a reversal rejected,
  closed-FY cancel rejected)
- balance/statement/trial-balance math incl. opening balances and running balance

---

# Do Not

Do not implement

- Any voucher entry UI (#50–#53), ledger inquiry screen, or report page (#61–#64)
- Sales/Purchase documents or their entry-breakup logic (#36, #42 pass finished lines)
- Stored/cached balances anywhere (computed only)
- Editing or deleting posted vouchers (no API may exist)
- Branch dimension (forward-noted migration when spec 12 lands)
- FY-closing checks beyond the documented rules (year-end closing process is future)
- Audit-log retrofits to other tables (`createdByUserId` here only)

---

# Success Criteria

Verify

- `postVoucher` creates a balanced voucher + entries atomically with an engine-generated
  number unique per company/FY/type; every documented rejection case rejects with a
  friendly `AppError`.
- No API exists to modify a posted voucher; `cancelVoucher` produces a correct mirrored
  reversal and flips status, atomically; the reversal chain rules hold.
- `getLedgerBalance`/`getLedgerStatement`/`getTrialBalance` return correct sums against
  a seeded test fixture (openings + mixed postings), with trial balance debits ===
  credits.
- Multiple concurrent posts of the same type produce no duplicate voucher numbers
  (Document Number Engine contract exercised through this engine).
- `npx tsc --noEmit`, `npx eslint src prisma`, `npx vitest run`, and `next build` all
  pass.

Feature-spec 31 (this spec) is `context/Phases/phase-tracker.md`'s Phase 2 **Shared ERP
Engines** item #29. Implement spec 34 (Document Number Engine, tracker #32) before it;
specs 32 (Inventory Engine) and 33 (GST Engine) are independent of it.
