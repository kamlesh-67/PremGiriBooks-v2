# 14 - Ledger Master

## Goal

Implement **Ledger Master** for **Premgiri Books ERP** — the individual accounting ledger (account) record that sits under a Ledger Group (`13-ledger-groups.md`) and that every future Voucher (Voucher Engine, feature 29), Customer/Supplier (features 24/25), and financial report (Trial Balance, Profit & Loss, Balance Sheet — Phase 6/9) will reference.

Per `context/Phases/phase-tracker.md`'s Phase 2 — Core Business Foundation → Accounting Foundation, this is the second of five features and depends directly on Ledger Groups.

Do **not** implement Bank Management, Expense Heads, Income Heads, the Voucher Engine, or any financial report in this task.

---

# Project Context

Before implementation, review

- PRD.md
- project-overview.md
- architecture-context.md
- code-standards.md
- ui-context.md
- ai-workflow-rules.md
- progress-tracker.md
- `context/Phases/phase-tracker.md`
- `13-ledger-groups.md` (the `LedgerGroup` model, its Ledger Group Selector component, and the company-scoping/`assertPermission()` conventions this task reuses)
- `08-company-management.md`, `12-branch-management.md` (the Master CRUD pattern this mirrors)

Follow all documented architecture and coding standards.

---

# Module Responsibilities

The Ledger Master module is responsible for

- Ledger Master (Create/Edit/View/Activate/Deactivate, scoped to the active company)
- Seeding each company's one default Ledger ("Cash") at company-creation time
- A reusable Ledger Selector component future modules (Bank Management, Expense Heads, Income Heads, and eventually the Voucher Engine, Sales, Purchase) will use to pick a ledger

The Ledger Master module is **not** responsible for

- Ledger Groups themselves (`13-ledger-groups.md`)
- Bank Account detail fields (`15-bank-management.md`)
- Posting, running balances, or any Voucher
- Customer/Supplier ledgers (features 24/25 will create Ledgers of their own through this module's service, once those features exist — not built here)

---

# Features

Implement

- Create Ledger
- Edit Ledger
- View Ledger
- Activate Ledger
- Deactivate Ledger

Do not implement delete. Matching every other master in this codebase, Ledgers are never permanently deleted.

---

# Data Model

Add to `prisma/schema.prisma`:

```text
enum BalanceType {
  DEBIT
  CREDIT
}

model Ledger {
  id                  String        @id @default(uuid())
  companyId           String
  company             Company       @relation(fields: [companyId], references: [id])
  ledgerGroupId       String
  ledgerGroup         LedgerGroup   @relation(fields: [ledgerGroupId], references: [id])
  name                String
  openingBalance      Decimal       @default(0) @db.Decimal(14, 2)
  openingBalanceType  BalanceType   @default(DEBIT)
  description         String?
  isSystemDefined     Boolean       @default(false)
  isActive            Boolean       @default(true)
  createdAt           DateTime      @default(now())
  updatedAt           DateTime      @updatedAt

  @@unique([companyId, name])
  @@index([companyId])
  @@index([ledgerGroupId])
}
```

**Deliberately no `currentBalance`/`closingBalance` column.** Per `code-standards.md`'s Financial Rules ("Ledger balances are never manually updated ... Trial Balance is generated from vouchers"), a Ledger's balance is always Opening Balance plus every posted Voucher entry against it — computed by the future Voucher Engine (feature 29), never stored as a mutable field here. Since no `Voucher` table exists yet, this phase's UI shows Opening Balance only; do not add a balance column now in anticipation of the Voucher Engine.

Opening Balance is stored as a non-negative amount plus an explicit Debit/Credit type, mirroring the input pattern of every Tally-class product this ERP's target users already know, rather than a single signed decimal — avoids sign-convention ambiguity in the UI and in future report calculations.

---

# Business Rules

- A Ledger's `name` must be unique within its company (DB-enforced: `@@unique([companyId, name])`).
- A Ledger must belong to an **active** Ledger Group. Creating or reassigning a Ledger under a deactivated group is rejected (there is nothing to reassign to yet in this phase since `ledgerGroupId` is not editable after creation — see below — but the create-time check still applies).
- **`ledgerGroupId` is immutable once a Ledger is created**, for the same reason `13-ledger-groups.md` makes a group's `parentGroupId`/`natureType` immutable — reclassifying a ledger after Vouchers may already reference it (once feature 29 exists) would silently reclassify historical postings. Edit only ever changes `name` (subject to uniqueness), `description`, and `openingBalance`/`openingBalanceType`.
- **The generic Ledger Master "Create Ledger" screen must exclude the "Bank Accounts" group and all of its descendants from the Ledger Group Selector.** A Ledger under "Bank Accounts" may only be created through Bank Management (`15-bank-management.md`), which creates the Ledger and its `BankAccount` detail row together, atomically. This guarantees no "Bank Accounts"-group Ledger can ever exist without a matching `BankAccount` row.
- **The system-defined "Cash" ledger (`isSystemDefined = true`) can never be renamed or deactivated** — every business needs a working cash ledger available from day one for billing (Sales, feature 33+), and future modules should be able to rely on it always existing and active.
- No permanent delete — Activate/Deactivate only.
- **Company-scoped for every user**, per the same Architecture Decision `13-ledger-groups.md` applies (a Ledger belongs to exactly one company and is not the tenant boundary). Derive the active company server-side; never accept it from the client.
- **Open question, not resolved by this task**: the "Sundry Debtors"/"Sundry Creditors" groups are left selectable in the generic Ledger Master screen for now, even though Customer Management (feature 24) and Supplier Management (feature 25) will eventually create Ledgers under those groups automatically when a Customer/Supplier is created. Recorded in `progress-tracker.md`'s Open Questions rather than pre-emptively blocked, since blocking now would be speculative — those modules don't exist yet and a legitimate non-customer/non-supplier use for a Sundry Debtors/Creditors ledger may exist in the interim. Revisit when features 24/25 are actually built.

---

# Default Ledger Seeding

Seed one default Ledger per company, `isSystemDefined = true`:

| Name | Ledger Group | Opening Balance |
| ---- | ------------- | ---------------- |
| Cash | Cash-in-Hand  | 0 / Debit         |

Seed this transactionally inside `companyService.createCompany()` (`08-company-management.md`), in the same transaction as `13-ledger-groups.md`'s default-group seeding and immediately after it (the "Cash-in-Hand" group must exist in the same transaction before this Ledger row can reference it).

---

# Ledger Service

Create

```text
src/modules/ledgers/services/ledger-service.ts
src/modules/ledgers/repositories/ledger-repository.ts
```

Responsibilities

- `seedDefaultLedger(companyId, tx)` — called from `companyService.createCompany()`'s transaction
- Create/Update/List/Activate/Deactivate, company-scoped per the Business Rules above
- `listSelectable(filters)` — active Ledgers for the current company, optionally filtered by group/nature/excluding a subtree (consumed by the Ledger Selector, and by `16-expense-heads.md`/`17-income-heads.md`'s scoped list views)
- `createUnderGroup(companyId, groupId, input, tx?)` — the underlying primitive `15-bank-management.md` (bank ledgers), `16-expense-heads.md`, and `17-income-heads.md` all call with a pre-resolved/pre-validated group, so none of those three features need to duplicate Ledger-creation logic

Business logic belongs here, following the Repository → Service → UI layering already established in every prior module.

---

# Validation

Use

Zod

Validate

- Name (required, min length, max 100 characters)
- Ledger Group (required; server re-validates the selected group is active and, for the generic Create Ledger screen, is not "Bank Accounts" or a descendant of it — never trust a client-supplied group id without this check)
- Opening Balance (required, non-negative decimal, defaults to 0)
- Opening Balance Type (required enum, `DEBIT`/`CREDIT`, defaults to `DEBIT`)
- Description (optional, max length)

Provide meaningful validation messages.

---

# UI

Create

```text
src/app/accounting/ledgers
```

Pages

- Ledger List (`/accounting/ledgers`)
- Create Ledger (`/accounting/ledgers/new`)
- Edit Ledger (`/accounting/ledgers/[id]/edit`)

Create reusable components

```text
src/modules/ledgers/components/
```

Examples

- Ledger Form (Ledger Group field uses `13-ledger-groups.md`'s Ledger Group Selector, filtered to exclude "Bank Accounts" and its descendants)
- Ledger Table
- Ledger Status Badge
- Ledger Selector — a lightweight combobox (name + group, searchable), reused by `15-bank-management.md`, `16-expense-heads.md`, `17-income-heads.md`, and future Voucher/Sales/Purchase screens whenever they need to pick a Ledger

Add a card for Ledger Master to the `/accounting` hub page `13-ledger-groups.md` created.

---

# Security

Every Create/Edit/Activate/Deactivate action must call `assertPermission(user, "accounting", "create" | "edit" | "delete")`; list/detail reads call `assertPermission(user, "accounting", "view")` — same as `13-ledger-groups.md`, no new permission catalog entries needed.

All reads/writes must be scoped to the requesting user's own company — never accept a company id from the client.

---

# Database

New model: `Ledger`, enum `BalanceType`. Extends `companyService.createCompany()` to seed the default "Cash" ledger — no changes to `Company` or `LedgerGroup`.

---

# Code Standards

Follow

- architecture-context.md
- code-standards.md

Requirements

- Strict TypeScript
- No `any`
- Reusable services
- No business logic in components
- Repository → Service → UI architecture

---

# Do Not

Do not implement

- Ledger Groups (`13-ledger-groups.md`, already implemented before this task)
- Bank Management, Expense Heads, Income Heads (`15`–`17`, next in this Accounting Foundation group)
- Voucher Engine, any Voucher type, ledger balances/postings, or `currentBalance`/`closingBalance` columns
- Trial Balance, Profit & Loss, Balance Sheet, or any other report
- Editable `ledgerGroupId` on an existing Ledger
- Customer/Supplier ledger auto-creation (features 24/25)
- GST, Sales, Purchase, Inventory

Those belong to future implementation tasks.

---

# Success Criteria

Verify

- Creating a new company seeds one default "Cash" ledger under "Cash-in-Hand", `isSystemDefined = true`, opening balance 0/Debit.
- The generic Create Ledger screen's Group selector excludes "Bank Accounts" and its descendants.
- The system-defined "Cash" ledger cannot be renamed or deactivated; custom ledgers can be (subject to per-company name uniqueness and the active-group requirement).
- A Ledger's group cannot be changed after creation.
- Ledgers are scoped to the active company only.
- No Ledger can be permanently deleted.
- No TypeScript errors.
- No ESLint errors.

Feature-spec 14 (this spec) falls under `context/Phases/phase-tracker.md`'s Accounting Foundation group. Completing it does not complete that group — `15-bank-management.md`, `16-expense-heads.md`, and `17-income-heads.md` remain undrafted-but-planned/drafted-but-not-implemented, per whichever this file's own status is by the time you read this.
