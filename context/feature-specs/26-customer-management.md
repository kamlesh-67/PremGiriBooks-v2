# 26 - Customer Management

> Feature-spec file number 26 (spec-file numbers are sequential and never reused). This
> feature is `context/Phases/phase-tracker.md`'s Phase 2 — Core Business Foundation →
> **Business Parties** item **#24 Customer Management**. It depends only on Ledger Master
> (feature-spec 14, implemented) — every Inventory Master is also already complete, but
> none is a dependency here.

## Goal

Implement **Customer Management** for **Premgiri Books ERP** — the **Permanent Customer**
master that Sales (Quotations #33, Sales Orders #34, Sales Invoice #36), the Pricing Engine
(#28), and Customer Reports (#68) will reference.

Per `architecture-context.md`'s Customer Architecture, only the **Permanent Customer** type
gets a master record and a Ledger. **Quick Customers** (created inline during billing) and
**Walk-in Customers** (no master, no ledger) are billing-time concerns owned by Sales
Invoice (#36) — they are *not* built here, and nothing in this task should preclude them
(they need no schema from this module; a Quick Customer that is later "converted" simply
becomes a row this module creates).

A Permanent Customer is modeled exactly like a Bank Account (`15-bank-management.md`): a
`Ledger` under the reserved **"Sundry Debtors"** group (or a descendant of it) plus a
`Customer` detail row (1:1) holding the party fields a generic Ledger has no room for.

This is a master-data feature only: **no transactions, no outstanding balances, no
statements, no credit enforcement, no pricing**. The master stores credit limit / credit
days / customer type as plain data; consuming them is the job of Sales Invoice (#36), the
Voucher Engine (#29), and the Pricing Engine (#28).

---

# Project Context

Before implementation, review

- PRD.md, project-overview.md, architecture-context.md (Customer Architecture, Engine
  Driven principle), code-standards.md, ui-context.md, ai-workflow-rules.md,
  progress-tracker.md
- `context/Phases/phase-tracker.md` (this feature's place in Phase 2 → Business Parties,
  and the Sales phase #33–#39 and Pricing group #26–#28 that build on it)
- `13-ledger-groups.md` (the reserved "Sundry Debtors" group this feature creates Ledgers
  under)
- `14-ledger-master.md` (the `Ledger` model, `ledgerService.createUnderGroup`, and the rule
  this task extends: reserved groups are excluded from the generic Create Ledger screen)
- `15-bank-management.md` (**the template for this module** — the Ledger + detail-row 1:1
  pattern, the combined form, the paired transactional writes, and the
  deactivate-both-together rule are all reused verbatim, with "Bank Accounts" swapped for
  "Sundry Debtors")
- `25-product-management.md` (the sectioned-form and filter-bar UI conventions this form
  reuses)

---

# Module Responsibilities

The Customers module is responsible for

- Permanent Customer Master (Create/Edit/View/Activate/Deactivate, scoped to the active
  company)
- The only path by which a Ledger under "Sundry Debtors" (or a descendant of it) may be
  created **from this feature onward** (see Business Rules for pre-existing rows)
- A reusable lookup future Sales features read from (active customers only)

The Customers module is **not** responsible for

- Quick or Walk-in customers (Sales Invoice #36 owns both; conversion of a Quick Customer
  into a Permanent Customer is also #36's flow — it will call this module's create service,
  not duplicate it)
- Outstanding tracking, customer statements, receivables (Voucher Engine #29 + Reports #68
  — no voucher data exists yet)
- Credit-limit *enforcement* (Sales Invoice #36 reads the stored limit; nothing enforces it
  today)
- Customer-specific pricing, price lists, discounts (Pricing group #26–#28 — this master
  only stores the `customerType` tier the Pricing Engine will key on)
- Supplier Management (feature-spec 27, the sibling Business Parties feature)

---

# Features

Implement

- Create Customer
- Edit Customer
- View Customers (list with search + filters: customer type, status)
- Activate Customer
- Deactivate Customer

Do not implement delete. Matching every other master in this codebase, Customers (and
their underlying Ledger) are never permanently deleted.

---

# Data Model

Add to `prisma/schema.prisma` (plus `customers Customer[]` on `Company`, and a `customer
Customer?` back-relation on `Ledger`, alongside the existing `bankAccount BankAccount?`):

```text
enum CustomerType {
  RETAIL
  WHOLESALE
  DEALER
  DISTRIBUTOR
}

model Customer {
  id              String       @id @default(uuid())
  companyId       String
  company         Company      @relation(fields: [companyId], references: [id])
  ledgerId        String       @unique
  ledger          Ledger       @relation(fields: [ledgerId], references: [id])
  customerType    CustomerType @default(RETAIL)
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
  country         String       @default("India")
  pinCode         String?
  creditLimit     Decimal?     @db.Decimal(14, 2)
  creditDays      Int?
  isActive        Boolean      @default(true)
  createdAt       DateTime     @default(now())
  updatedAt       DateTime     @updatedAt

  @@index([companyId])
}
```

Field decisions

- **`Customer` is a strict 1:1 extension of `Ledger`** (`ledgerId @unique`) — the display
  name, opening balance/type, description, and active/inactive state live on the `Ledger`
  row; `Customer` only adds party fields. `companyId` duplicates `ledger.companyId` — the
  same deliberate denormalization as `BankAccount`, kept in sync only because the pair is
  always written together in one transaction, never independently.
- **No `customerCode`** — the customer's unique identity per company is the Ledger's name
  (`@@unique([companyId, name])`, already enforced). Auto-numbered codes are the Document
  Number Engine's (#32) job; a manually-entered code column would be superseded by it
  (same reasoning `25-product-management.md` applied to auto-numbering).
- `customerType` — `RETAIL` / `WHOLESALE` / `DEALER` / `DISTRIBUTOR`, default `RETAIL`.
  Stored as **plain data** for the Pricing Engine (#28) and Price Lists (#27) to key on
  (project-overview.md: "Support retail, wholesale, dealer, and distributor pricing"). No
  pricing behavior attaches to it in this task.
- `gstin` — optional (unregistered/consumer customers are common), validated for format
  when present. **Deliberately not unique**: two customer records may legitimately share a
  GSTIN (e.g. two branches of the same buyer registered in one state, tracked as separate
  parties/ledgers). `Company.gstin` is unique because a company *is* the registration;
  a customer merely *references* one.
- `pan` — optional, format-validated when present.
- `mobileNumber` / `alternateMobile` / `email` — all optional. A Permanent Customer needs a
  ledger and a name; contact data is strongly encouraged by the UI but not structurally
  required (unlike a Quick Customer, whose whole point is name + mobile — #36's concern).
  Deliberately not unique — family members or businesses can share numbers.
- Address — flat optional columns matching `Company`'s exact address shape
  (`addressLine1/2`, `city`, `state`, `district`, `country @default("India")`, `pinCode`).
  One address set only: multiple shipping addresses are deferred until Sales documents
  exist to consume them (see Do Not). `state` is stored as a plain string now; the GST
  Engine (#31) owns formalizing place-of-supply state codes later (same deferral posture
  as Unit's `uqcCode`).
- `creditLimit` — optional `Decimal(14,2)`, plain data. Enforcement (blocking a sale that
  would exceed it) requires outstanding balances, which require vouchers — Sales Invoice
  (#36) / Voucher Engine (#29) territory.
- `creditDays` — optional integer (payment terms in days), plain data for the same future
  consumers.
- Opening balance lives on the `Ledger` row, defaulting to `DEBIT` for a debtor (a customer
  who owes us money) — the form default; `CREDIT` remains selectable (advance received).

**No `isSystemDefined` and no seeding — deliberate.** Nothing structurally depends on any
customer existing (the Walk-in "Cash Customer" is a no-master concept by definition, per
the Customer Architecture — do *not* seed a placeholder customer for it).

---

# Business Rules

- Creating a Customer transactionally creates **both** the underlying `Ledger` (name = the
  customer's display name, assigned to "Sundry Debtors" or one of its descendants) **and**
  the `Customer` row referencing it, in one transaction. Neither can exist without the
  other. Reuse `ledgerService.createUnderGroup` — do not duplicate Ledger-write logic
  (the `15-bank-management.md` shape exactly).
- **The Ledger Group chosen must be "Sundry Debtors" or a descendant of it** — validated
  server-side by walking the group's parent chain, never trusting a client-supplied group
  id. If the company has no custom sub-groups under "Sundry Debtors", the group is simply
  "Sundry Debtors" itself with no picker shown (the bank-management rule verbatim).
- **The generic Ledger Master "Create Ledger" screen must now also exclude "Sundry
  Debtors" and all of its descendants** from its Ledger Group Selector, exactly as it
  already excludes "Bank Accounts" (`14-ledger-master.md`). From this feature onward, a
  Ledger under "Sundry Debtors" may only be created through Customer Management.
- **Ledgers linked to a `Customer` row are also protected from the generic Ledger
  Master *edit/activate/deactivate* paths.** The generic Ledger edit screen/service and
  the generic status actions must reject (treat as not-editable) any Ledger that has a
  `customer` detail row — its name, description, opening balance, group, and active
  status change only through Customer Management's combined form, inside the paired
  transaction. Without this, a generic deactivate of just the Ledger half would break
  the deactivate-both-together invariant below. During implementation, check whether
  `bankAccount`-linked Ledgers already carry the equivalent guard (spec 15 states the
  paired invariant but never made the generic-edit exclusion explicit) — if missing,
  extend the same detail-row check to them in this task and record the finding in
  `progress-tracker.md`. Unlinked ledgers (including the pre-existing generic rows
  covered next) keep unrestricted generic editing.
- **Pre-existing generic Ledgers under "Sundry Debtors" (created via the generic screen
  before this feature) remain valid, untouched Ledgers — they are not customers.** They
  keep working as plain ledgers (editable via Ledger Master as before — the generic *edit*
  path is not group-restricted, only *create* is), but they never appear in the Customer
  list or the future Sales customer lookup, which read the `Customer` table. During
  implementation, check the dev database for such rows and record the finding in
  `progress-tracker.md`; do **not** build a backfill/conversion flow (no spec has asked
  for one — same posture as every previously-skipped speculative repair path).
- Editing a Customer updates both the `Customer` detail fields and the underlying Ledger's
  name/description/opening balance/group through one combined form, in one transaction.
  Re-parenting to a different group re-validates the "Sundry Debtors or descendant" rule.
- **Deactivating a Customer deactivates both the `Customer` row and its underlying
  `Ledger` together**, in one transaction — same for Activate. There is no way to toggle
  just one half (the bank-management invariant verbatim).
- The Ledger name (customer display name) stays unique per company via the existing
  `Ledger` `@@unique([companyId, name])` — surface the conflict with a friendly,
  field-specific message.
- GSTIN and PAN are format-validated when present but not unique (see Data Model).
- Deactivation has no dependent-record invariant to guard today (no sales documents
  exist); deactivated customers keep all data and simply disappear from future document
  lookups (`listSelectableCustomers`).
- **Company-scoped for every user.** Derive the active company server-side from
  `getCurrentCompanyUser()`; never accept a company id from the client. Treat "belongs to
  a different company" identically to "not found."

---

# Service / Repository

Create

```text
src/modules/customers/repositories/customer-repository.ts
src/modules/customers/services/customer-service.ts
src/modules/customers/validation/customer-schema.ts
src/modules/customers/actions/customer-actions.ts
src/modules/customers/components/…
src/types/customer.ts
```

- `customerService`: `listCustomers(filters)` (status/search/customerType filters; search
  covers the ledger name, mobile number, and GSTIN; list rows include the ledger name via
  a narrow `ledger` select), `getCustomer(id)` (with the ledger fields for the edit form),
  `createCustomer(input)`, `updateCustomer(id, input)`, `activateCustomer(id)`,
  `deactivateCustomer(id)`, and `listSelectableCustomers()` (active only — the lookup
  Quotations/Sales Orders/Sales Invoice will consume).
- Repository writes always operate on the `Customer` + `Ledger` pair inside one
  transaction (`runInTransaction`), reusing the Ledger service/repository primitives from
  feature-spec 14 rather than duplicating Ledger-write logic — the
  `bank-account-repository.ts` shape. The "Sundry Debtors or descendant" parent-chain walk
  runs inside the same transaction as the write.
- `creditLimit` is a Decimal column: normalize it to a plain `number` before it leaves the
  repository (the `Ledger.openingBalance`/GstRate serialization-boundary convention), so
  `src/types/customer.ts` exposes `creditLimit: number | null`.
- Server Actions use the shared `runAction` envelope (`src/lib/run-action.ts`).

---

# Validation

Zod (`customer-schema.ts`):

- Display Name (the underlying Ledger's name) — required, trimmed, 2–100 characters
- Ledger Group — required uuid (server re-validates active + "Sundry Debtors or
  descendant")
- Customer Type — required enum: `RETAIL` / `WHOLESALE` / `DEALER` / `DISTRIBUTOR`
  (export a plain string-literal tuple so the client form never imports the Prisma
  runtime — the `HSN_CODE_TYPES` convention)
- Contact Person — optional, trimmed, max 100 characters
- Mobile Number / Alternate Mobile — optional, 10-digit `/^[6-9]\d{9}$/` when present
  (the `user-schema`/`warehouse-schema` MOBILE_REGEX convention), blank→undefined
- Email — optional, valid email format when present, blank→undefined
- GSTIN — optional, standard 15-character GSTIN format when present
  (`/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/`, uppercased before validation);
  reuse/extract the company module's existing GSTIN validation as a shared helper rather
  than writing a second regex, if one exists there
- PAN — optional, `/^[A-Z]{5}[0-9]{4}[A-Z]$/` when present, uppercased before validation
- Address fields — all optional, trimmed, sensible max lengths (match the company form's
  bounds); PIN code 6 digits when present
- Credit Limit — optional number, ≥ 0, max 2 decimal places (the `hasAtMostTwoDecimals`
  tolerance refine from `gst-rate-schema.ts`)
- Credit Days — optional integer, 0–365
- Opening Balance / Opening Balance Type — same as `14-ledger-master.md`'s Ledger fields
  (defaults 0 / **Debit**)
- Description — optional (stored on the Ledger row), max 500, blank→undefined

Create and Update accept the same field set. Every blank optional string normalizes to
`undefined` (the established convention).

---

# UI

Pages (under the existing **Masters** hub)

- `/masters/customers` — Customer list (Name, Mobile, GSTIN, Type, Credit Limit —
  `font-financial` right-aligned — Status, Actions) with search and type/status filters
  (reuse the `ProductFilterBar` URL-state pattern from `25-product-management.md`)
- `/masters/customers/new` — Create Customer
- `/masters/customers/[id]/edit` — Edit Customer

Components (`src/modules/customers/components/`): Customer Table (with filter bar),
Customer Form, Customer Type Badge, Customer Status Badge. The form combines the Ledger
fields (Display Name, Group picker limited to "Sundry Debtors" + descendants — hidden when
no sub-groups exist, Opening Balance/Type, Description) with the customer fields, grouped
into sections (Identity, Contact, Tax Registration, Address, Credit Terms, Opening
Balance) — keep each section a focused sub-component per the file-size standards (the
product-form precedent). A single `CustomerForm` serves create and edit (identical field
set — the established simplification).

Wire-up

- Add a "Customers" card to the `/masters` hub page (`src/app/masters/page.tsx`), matching
  the existing card convention (lucide `Users` icon).
- Add `customers: "Customers"` to `src/constants/breadcrumbs.ts`.
- The Sidebar's Masters entry already links to `/masters` — no sidebar change.

The `/masters` hub page's coarse `isCurrentUserCompanyAdmin()` gate remains a known
pre-existing inconsistency, out of scope (recorded in `19-unit-management.md`).

---

# Security

Every action gates via `assertPermission(user, "masters", …)` — `view` for list/detail
reads, `create`/`edit` for writes, and `delete` for Activate/Deactivate (the documented
convention since `ledger-service.ts`). No Permission catalog changes. Customers sit under
`masters` (not `sales`) because project-overview.md's Master Management section owns them;
a company wanting its Sales role to manage customers grants that role `masters` actions
via Role Management — role seeds are editable by design.

All reads/writes scoped to the requesting user's own company (see Business Rules).

---

# Database

New model: `Customer`, new enum `CustomerType`. New migration. Adds the `customers`
back-relation to `Company` and a `customer Customer?` back-relation to `Ledger` — no other
change to existing tables. No seeding, no bootstrap/domain-event changes (the "Sundry
Debtors" group already exists in every company via the chart-of-accounts skeleton from
`13-ledger-groups.md`).

---

# Code Standards

Strict TypeScript, no `any`, Repository → Service → Server Action → UI, no business logic
in components (no credit or balance math anywhere in the UI — Engine Driven), Zod
validation at the boundary, Pino logging via the shared error helpers, vitest coverage for
the schema (the established per-master test convention).

---

# Do Not

Do not implement

- Quick Customers or Walk-in Customers (Sales Invoice #36 owns billing-time customer
  creation and the convert-to-permanent flow)
- Outstanding balances, receivables, customer statements, or ageing (Voucher Engine #29 +
  Reports #68)
- Credit-limit or credit-days *enforcement* of any kind (plain stored data only)
- Customer-specific pricing, price lists, discounts, margin profiles (Pricing group
  #26–#28)
- Multiple shipping/delivery addresses (defer until Sales documents consume them)
- Customer groups/categories beyond the `customerType` enum
- A backfill/conversion flow for pre-existing generic Ledgers under "Sundry Debtors" (see
  Business Rules — record findings only)
- Supplier Management (feature-spec 27 — the next Business Parties feature)
- Delete endpoints

---

# Success Criteria

Verify

- Creating a Customer creates exactly one `Ledger` (under "Sundry Debtors" or a
  descendant) and one `Customer` row, atomically; neither can exist without the other.
- The Ledger Group picker only offers "Sundry Debtors" and its descendants; the generic
  Create Ledger screen no longer offers "Sundry Debtors" or its descendants.
- Deactivating a Customer deactivates both rows together; no Customer can be active while
  its Ledger is inactive, or vice versa.
- Duplicate display name produces a friendly field-specific error; GSTIN/PAN format
  violations are rejected; two customers *may* share a GSTIN.
- Customers of all four types can be created/edited/listed/activated/deactivated, scoped
  to the active company only; cross-company ids resolve as not-found.
- `creditLimit`/`creditDays` round-trip as plain stored data with no behavior attached.
- No delete is possible anywhere.
- `/masters` hub shows the Customers card; breadcrumbs label `/masters/customers` as
  "Customers".
- `npx tsc --noEmit`, `npx eslint src prisma`, `npx vitest run`, and `next build` all
  pass.

Feature-spec 26 (this spec) is `context/Phases/phase-tracker.md`'s Phase 2 **Business
Parties** item #24. Completing it does not complete the group — Supplier Management
(feature-spec 27, tracker #25) remains.
