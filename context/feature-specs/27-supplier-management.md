# 27 - Supplier Management

> Feature-spec file number 27 (spec-file numbers are sequential and never reused). This
> feature is `context/Phases/phase-tracker.md`'s Phase 2 — Core Business Foundation →
> **Business Parties** item **#25 Supplier Management** — the credit-side mirror of
> Customer Management (feature-spec 26). It depends only on Ledger Master (feature-spec
> 14, implemented). **Implement after feature-spec 26** — this spec is written as a
> faithful mirror of it and reuses every shared piece that feature establishes.

## Goal

Implement **Supplier Management** for **Premgiri Books ERP** — the supplier/vendor master
that Purchase (Purchase Orders #40, Goods Receipt Notes #41, Purchase Invoice #42) and
Supplier Reports (#69) will reference.

A Supplier is modeled exactly like a Customer (feature-spec 26) and a Bank Account
(`15-bank-management.md`): a `Ledger` under the reserved **"Sundry Creditors"** group (or
a descendant of it) plus a `Supplier` detail row (1:1) holding the party fields a generic
Ledger has no room for.

This spec deliberately mirrors `26-customer-management.md` the way `17-income-heads.md`
mirrored `16-expense-heads.md`: **everything not called out as a difference below follows
feature-spec 26 exactly**, with "Customer" → "Supplier", "Sundry Debtors" → "Sundry
Creditors", and the debit default → credit. Where feature-spec 26 extracted a shared
helper (GSTIN/PAN validation, the parent-chain group walk, form sections), reuse it — do
not duplicate.

This is a master-data feature only: **no transactions, no outstanding balances, no
statements, no pricing**. Supplier outstanding management (project-overview.md's Purchase
section) is the Voucher Engine's (#29) and Purchase Invoice's (#42) job.

---

# Project Context

Before implementation, review

- PRD.md, project-overview.md, architecture-context.md, code-standards.md, ui-context.md,
  ai-workflow-rules.md, progress-tracker.md
- `context/Phases/phase-tracker.md` (this feature's place in Phase 2 → Business Parties,
  and the Purchase phase #40–#43 that builds on it)
- `13-ledger-groups.md` (the reserved "Sundry Creditors" group this feature creates
  Ledgers under)
- `14-ledger-master.md` (the `Ledger` model and the reserved-group exclusion rule this
  task extends again)
- `15-bank-management.md` and **`26-customer-management.md`** (the Ledger + detail-row 1:1
  pattern; feature-spec 26 is the direct template — same module layout, same paired
  transactional writes, same combined form)

---

# Module Responsibilities

The Suppliers module is responsible for

- Supplier Master (Create/Edit/View/Activate/Deactivate, scoped to the active company)
- The only path by which a Ledger under "Sundry Creditors" (or a descendant of it) may be
  created **from this feature onward** (pre-existing generic rows: same rule as
  feature-spec 26's "Sundry Debtors" handling)
- A reusable lookup future Purchase features read from (active suppliers only)

The Suppliers module is **not** responsible for

- Supplier outstanding, payables, statements, or ageing (Voucher Engine #29 + Purchase
  Invoice #42 + Reports #69)
- Purchase Orders, GRNs, Purchase Invoices, Purchase Returns (Phase 4, #40–#43)
- Supplier-side pricing or purchase price maintenance (`Product.purchasePrice` is the
  product master's field; the Purchase module overwrites it per the Latest Purchase Cost
  strategy — not this module)
- Customer Management (feature-spec 26, already implemented by the time this runs)

---

# Features

Implement

- Create Supplier
- Edit Supplier
- View Suppliers (list with search + filters: status)
- Activate Supplier
- Deactivate Supplier

Do not implement delete. Matching every other master in this codebase, Suppliers (and
their underlying Ledger) are never permanently deleted.

---

# Data Model

Add to `prisma/schema.prisma` (plus `suppliers Supplier[]` on `Company`, and a `supplier
Supplier?` back-relation on `Ledger`, alongside `bankAccount` and `customer`):

```text
model Supplier {
  id              String   @id @default(uuid())
  companyId       String
  company         Company  @relation(fields: [companyId], references: [id])
  ledgerId        String   @unique
  ledger          Ledger   @relation(fields: [ledgerId], references: [id])
  contactPerson   String?
  mobileNumber    String?
  alternateMobile String?
  email           String?
  gstin           String?
  pan             String?
  addressLine1    String?
  addressLine2    String?
  city            String?
  state           String?
  district        String?
  country         String   @default("India")
  pinCode         String?
  creditDays      Int?
  isActive        Boolean  @default(true)
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  @@index([companyId])
}
```

Differences from `Customer`, each deliberate

- **No `supplierType` enum** — the RETAIL/WHOLESALE/DEALER/DISTRIBUTOR tiers exist for the
  *selling*-side Pricing Engine; nothing prices purchases by supplier tier. YAGNI.
- **No `creditLimit`** — a credit limit is a cap *we* impose on a debtor. What a supplier
  extends to us is their decision, not a control this system enforces; storing it would be
  dead data. `creditDays` (agreed payment terms) is kept — Purchase Invoice (#42) and
  payables ageing will consume it.
- Opening balance lives on the `Ledger` row, defaulting to **`CREDIT`** for a creditor (a
  supplier we owe money to) — the form default; `DEBIT` remains selectable (advance paid).

Everything else (1:1 `ledgerId @unique` extension, denormalized `companyId`, no
`supplierCode` — Document Number Engine #32 owns numbering, non-unique format-validated
`gstin`/`pan`, optional contact fields, flat `Company`-shaped address columns, plain-string
`state` pending the GST Engine, no `isSystemDefined`, no seeding) matches
`26-customer-management.md`'s Data Model decisions verbatim.

---

# Business Rules

All of feature-spec 26's Business Rules apply with the substitutions above. Explicitly:

- Create transactionally writes the `Ledger` (under **"Sundry Creditors"** or a
  descendant, validated server-side via the parent-chain walk) **and** the `Supplier` row
  in one transaction; neither exists without the other. Reuse
  `ledgerService.createUnderGroup`.
- **The generic Ledger Master "Create Ledger" screen must now also exclude "Sundry
  Creditors" and all of its descendants** — the third reserved group, after "Bank
  Accounts" (spec 15) and "Sundry Debtors" (spec 26). If the exclusion list is still two
  hardcoded checks by now, refactor it into one shared reserved-groups constant the three
  modules and Ledger Master all read.
- **Ledgers linked to a `Supplier` row are protected from the generic Ledger Master
  edit/activate/deactivate paths** exactly as Customer-linked ledgers are (spec 26's
  detail-row guard, extended to check `supplier` alongside `customer` and
  `bankAccount`) — changes route only through Supplier Management's paired transaction;
  unlinked legacy ledgers keep unrestricted generic editing.
- Pre-existing generic Ledgers under "Sundry Creditors" remain valid plain Ledgers, are
  never suppliers, and get no backfill/conversion flow — check the dev database and record
  findings in `progress-tracker.md`, exactly as feature-spec 26 did for "Sundry Debtors".
- Edit updates both rows through one combined form in one transaction; re-parenting
  re-validates the group rule. Activate/Deactivate always toggles **both rows together**.
- Ledger name unique per company (existing constraint) with a friendly field-specific
  message; GSTIN/PAN format-validated, not unique.
- Company-scoped for every user via `getCurrentCompanyUser()`; cross-company resolves as
  not-found.

---

# Service / Repository

Create

```text
src/modules/suppliers/repositories/supplier-repository.ts
src/modules/suppliers/services/supplier-service.ts
src/modules/suppliers/validation/supplier-schema.ts
src/modules/suppliers/actions/supplier-actions.ts
src/modules/suppliers/components/…
src/types/supplier.ts
```

- `supplierService`: `listSuppliers(filters)` (status/search filters; search covers ledger
  name, mobile number, GSTIN), `getSupplier(id)`, `createSupplier(input)`,
  `updateSupplier(id, input)`, `activateSupplier(id)`, `deactivateSupplier(id)`, and
  `listSelectableSuppliers()` (active only — the lookup Purchase Orders/Purchase Invoice
  will consume).
- Same paired-transaction repository shape as `customer-repository.ts`. No Decimal columns
  on `Supplier` itself (opening balance is the Ledger's, already normalized by the ledger
  module).
- Server Actions use the shared `runAction` envelope.

---

# Validation

Zod (`supplier-schema.ts`): identical to `customer-schema.ts` minus Customer Type and
Credit Limit —

- Display Name — required, trimmed, 2–100 characters (the Ledger's name)
- Ledger Group — required uuid (server re-validates active + "Sundry Creditors or
  descendant")
- Contact Person / Mobile / Alternate Mobile / Email / GSTIN / PAN / Address fields —
  same rules, shared helpers, and blank→undefined normalization as feature-spec 26
- Credit Days — optional integer, 0–365
- Opening Balance / Opening Balance Type — same as the Ledger fields (defaults 0 /
  **Credit**)
- Description — optional (stored on the Ledger row), max 500, blank→undefined

Create and Update accept the same field set.

---

# UI

Pages (under the existing **Masters** hub)

- `/masters/suppliers` — Supplier list (Name, Mobile, GSTIN, Credit Days, Status,
  Actions) with search and status filter
- `/masters/suppliers/new` — Create Supplier
- `/masters/suppliers/[id]/edit` — Edit Supplier

Components (`src/modules/suppliers/components/`): Supplier Table, Supplier Form, Supplier
Status Badge — the customer components' structure with the two dropped fields removed. A
single `SupplierForm` serves create and edit. Same section grouping (Identity, Contact,
Tax Registration, Address, Credit Terms, Opening Balance); if feature-spec 26's section
sub-components are cleanly parameterizable, share them rather than copying — otherwise
mirror them and record the duplication for a later consolidation pass (the established
"consolidate when a change touches them" posture).

Wire-up

- Add a "Suppliers" card to the `/masters` hub page, matching the existing card convention
  (lucide `Truck` icon).
- Add `suppliers: "Suppliers"` to `src/constants/breadcrumbs.ts`.
- No sidebar change.

---

# Security

Every action gates via `assertPermission(user, "masters", …)` — `view` for reads,
`create`/`edit` for writes, `delete` for Activate/Deactivate. No Permission catalog
changes. Same `masters`-not-`purchase` placement reasoning as feature-spec 26's
`masters`-not-`sales` decision.

All reads/writes scoped to the requesting user's own company.

---

# Database

New model: `Supplier`. New migration. Adds the `suppliers` back-relation to `Company` and
a `supplier Supplier?` back-relation to `Ledger` — no other change to existing tables. No
seeding, no bootstrap changes (the "Sundry Creditors" group already exists in every
company via the chart-of-accounts skeleton from `13-ledger-groups.md`).

---

# Code Standards

Strict TypeScript, no `any`, Repository → Service → Server Action → UI, no business logic
in components, Zod validation at the boundary, Pino logging via the shared error helpers,
vitest coverage for the schema.

---

# Do Not

Do not implement

- Purchase Orders, GRNs, Purchase Invoices, Purchase Returns (Phase 4, #40–#43)
- Supplier outstanding, payables, statements, or ageing (Voucher Engine #29 + Reports #69)
- Supplier bank/payment details (defer until a payment feature needs them — Payment
  Voucher #50 is the first candidate)
- A `supplierType` tier or `creditLimit` field (see Data Model — deliberate omissions)
- Multiple addresses, supplier groups, or supplier-product mappings
- A backfill/conversion flow for pre-existing generic Ledgers under "Sundry Creditors"
  (record findings only)
- Delete endpoints

---

# Success Criteria

Verify

- Creating a Supplier creates exactly one `Ledger` (under "Sundry Creditors" or a
  descendant) and one `Supplier` row, atomically; neither can exist without the other.
- The Ledger Group picker only offers "Sundry Creditors" and its descendants; the generic
  Create Ledger screen now excludes all three reserved groups ("Bank Accounts", "Sundry
  Debtors", "Sundry Creditors") and their descendants.
- Deactivating a Supplier deactivates both rows together; no half-toggled state is
  reachable.
- Duplicate display name produces a friendly field-specific error; GSTIN/PAN format
  violations are rejected; two suppliers may share a GSTIN.
- Opening balance defaults to Credit; suppliers are scoped to the active company only;
  cross-company ids resolve as not-found.
- No delete is possible anywhere.
- `/masters` hub shows the Suppliers card; breadcrumbs label `/masters/suppliers` as
  "Suppliers".
- `npx tsc --noEmit`, `npx eslint src prisma`, `npx vitest run`, and `next build` all
  pass.

Completing this spec completes `context/Phases/phase-tracker.md`'s Phase 2 **Business
Parties** group; Phase 2 overall remains In Progress (the Pricing group #26–#28 and Shared
ERP Engines #29–#32 follow — Pricing is now fully unblocked, since it depends on Products
and Customers).
