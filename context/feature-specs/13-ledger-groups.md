# 13 - Ledger Groups

## Goal

Implement **Ledger Groups** for **Premgiri Books ERP** — the chart-of-accounts backbone every later accounting feature depends on.

Per `context/Phases/phase-tracker.md`'s **Phase 2 — Core Business Foundation → Accounting Foundation** section, this is the first of five features (Ledger Groups → Ledger Master → Bank Management → Expense Heads → Income Heads) that together give the Voucher Engine (feature 29), GST Engine (feature 31), and every future financial report (Trial Balance, Profit & Loss, Balance Sheet — Phase 6/9) something to classify and post against. No `Ledger`, `LedgerGroup`, or `Voucher` table exists yet — `06-database-foundation.md` deliberately excluded them ("Do not create ... Accounting ... Vouchers ... Ledgers. Only create the shared database foundation.").

Ledger Groups are the standard Indian-accounting classification structure (the same "Primary Group" concept used by every Tally-class product this ERP's target users already know) — a hierarchy of named groups, each carrying a fixed fundamental nature (Asset, Liability, Income, or Expense) that every individual Ledger (feature 14) will belong to.

Do **not** implement Ledger Master, Bank Management, Expense Heads, Income Heads, the Voucher Engine, or any financial report in this task.

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
- `context/Phases/phase-tracker.md` (this feature's place in Phase 2 — Core Business Foundation → Accounting Foundation)
- `06-database-foundation.md` (confirms no Ledger/Accounting tables exist yet)
- `08-company-management.md` (the `companyService.createCompany()` transaction this task extends — see Seeding)
- `11-role-permissions.md` (the `assertPermission()` helper this task must use — see Security)
- `12-branch-management.md` (the company-scoped-master CRUD pattern this task mirrors)
- The Architecture Decisions entries in `progress-tracker.md` dated 2026-07-13 (items 2 and 4 — company-scoped authorization is the default, and every module after Role & Permission Management must gate on `assertPermission()`, never a new hardcoded Administrator check)

Follow all documented architecture and coding standards.

---

# Module Responsibilities

The Ledger Groups module is responsible for

- Ledger Group Master (Create/Edit/View/Activate/Deactivate, scoped to the active company)
- Seeding each company's standard default chart-of-accounts group skeleton at company-creation time
- A reusable Ledger Group tree/lookup future Ledger Master, Bank Management, Expense Heads, and Income Heads all read from

The Ledger Groups module is **not** responsible for

- Individual Ledgers (`14-ledger-master.md`)
- Bank Account detail (`15-bank-management.md`)
- Posting, balances, or any Voucher (Voucher Engine, feature 29)
- Trial Balance, Profit & Loss, Balance Sheet (Phase 6/9 — these will *read* group nature/classification, not be built here)

---

# Features

Implement

- Create Ledger Group
- Edit Ledger Group (name and remarks only — see Business Rules)
- View Ledger Group (list, rendered as a tree by parent/child)
- Activate Ledger Group
- Deactivate Ledger Group

Do not implement delete. Matching every other master in this codebase, Ledger Groups are never permanently deleted — `ledgerGroupService` exposes no `deleteLedgerGroup` method and no delete API route exists.

---

# Data Model

Add to `prisma/schema.prisma`:

```text
enum AccountNature {
  ASSET
  LIABILITY
  INCOME
  EXPENSE
}

model LedgerGroup {
  id                 String        @id @default(uuid())
  companyId          String
  company            Company       @relation(fields: [companyId], references: [id])
  name               String
  parentGroupId      String?
  parentGroup        LedgerGroup?  @relation("LedgerGroupHierarchy", fields: [parentGroupId], references: [id])
  childGroups        LedgerGroup[] @relation("LedgerGroupHierarchy")
  natureType         AccountNature
  affectsGrossProfit Boolean       @default(false)
  isSystemDefined    Boolean       @default(false)
  isActive           Boolean       @default(true)
  createdAt          DateTime      @default(now())
  updatedAt          DateTime      @updatedAt

  @@unique([companyId, name])
  @@index([companyId])
  @@index([parentGroupId])
}
```

`affectsGrossProfit` only carries meaning for `INCOME`/`EXPENSE` nature groups — `true` marks a "Direct" group (contributes to Gross Profit — Sales Accounts, Purchase Accounts, Direct Incomes, Direct Expenses), `false` marks "Indirect" (below the Gross Profit line — Indirect Incomes, Indirect Expenses). For `ASSET`/`LIABILITY` groups it is always `false` and has no reporting effect; do not surface it as an editable field for those two natures.

**Deliberate simplification — no cycle-prevention logic needed.** `parentGroup`/`natureType`/`affectsGrossProfit` are set once at creation and are never editable afterward (see Business Rules). A brand-new group has zero children by definition, so it can never become an ancestor of the parent it is being attached to — the classic "does this move create a cycle" check that a mutable-parent hierarchy would need simply does not apply here.

---

# Business Rules

- A Ledger Group's `name` must be unique within its company (DB-enforced: `@@unique([companyId, name])`).
- **A top-level group (no `parentGroupId`) must have an explicit `natureType`, chosen by the creator.** A sub-group (has a `parentGroupId`) always inherits its parent's `natureType` and `affectsGrossProfit` — these are not independently settable on a sub-group and the UI must not offer them as fields when a parent is selected. This guarantees the hierarchy never mixes fundamental accounting classes under one branch.
- **`parentGroupId`, `natureType`, and `affectsGrossProfit` are immutable once a group is created.** Edit only ever changes `name` (subject to the uniqueness rule above) and free-text remarks. Re-parenting or reclassifying a group after ledgers may already exist under it (once `14-ledger-master.md` is implemented) would silently reclassify historical structure — not permitted, matching this codebase's "financial data is immutable" standard (`code-standards.md`).
- **System-defined groups (`isSystemDefined = true`) can never be renamed or deactivated.** They are the seeded default skeleton every future Trial Balance/Profit & Loss/Balance Sheet report depends on existing. Only user-created (`isSystemDefined = false`) groups may be edited or deactivated.
- **A group cannot be deactivated while it has any active child group.** (Once `14-ledger-master.md` exists: also blocked while any active Ledger is still assigned to it — record this as a forward-compatible rule now; there is nothing to check against yet since no `Ledger` table exists in this task.)
- **Company-scoped for every user, not "Administrator sees everything across companies."** Per the Architecture Decision recorded in `progress-tracker.md` (2026-07-13, item 2, extending the rule `10-user-management.md` established): `LedgerGroup` belongs to exactly one company and is not the tenant-boundary entity, so it defaults to the company-scoped-for-everyone model. Derive the active company server-side from the requesting user's own session (`getCurrentUser()`/company context helper); never accept it as a client-supplied parameter. Treat "belongs to a different company" identically to "not found."

---

# Default Group Seeding

Every company must start with the following standard chart-of-accounts skeleton — the same set of Primary Groups used by Tally-class Indian accounting software, which this ERP's target users already recognize. Seed these as `isSystemDefined = true` rows.

| Group                       | Parent              | Nature    | Affects Gross Profit |
| ---------------------------- | -------------------- | --------- | --------------------- |
| Capital Account              | —                    | LIABILITY | false                 |
| Reserves & Surplus           | —                    | LIABILITY | false                 |
| Loans (Liability)            | —                    | LIABILITY | false                 |
| Secured Loans                | Loans (Liability)    | LIABILITY | false                 |
| Unsecured Loans              | Loans (Liability)    | LIABILITY | false                 |
| Current Liabilities          | —                    | LIABILITY | false                 |
| Sundry Creditors             | Current Liabilities  | LIABILITY | false                 |
| Duties & Taxes               | Current Liabilities  | LIABILITY | false                 |
| Provisions                   | Current Liabilities  | LIABILITY | false                 |
| Fixed Assets                 | —                    | ASSET     | false                 |
| Investments                  | —                    | ASSET     | false                 |
| Current Assets               | —                    | ASSET     | false                 |
| Bank Accounts                | Current Assets       | ASSET     | false                 |
| Cash-in-Hand                 | Current Assets       | ASSET     | false                 |
| Sundry Debtors               | Current Assets       | ASSET     | false                 |
| Loans & Advances (Asset)     | Current Assets       | ASSET     | false                 |
| Misc. Expenses (Asset)       | —                    | ASSET     | false                 |
| Sales Accounts               | —                    | INCOME    | true                  |
| Direct Incomes               | —                    | INCOME    | true                  |
| Indirect Incomes             | —                    | INCOME    | false                 |
| Purchase Accounts            | —                    | EXPENSE   | true                  |
| Direct Expenses              | —                    | EXPENSE   | true                  |
| Indirect Expenses            | —                    | EXPENSE   | false                 |

Seed these transactionally inside `companyService.createCompany()` (`08-company-management.md`), immediately after the `Company` row is created, in the same transaction — mirroring how `prisma/seed.ts` already atomically bootstraps a company + admin user. If group seeding fails, company creation must roll back with it; a company must never exist with an incomplete chart of accounts. Insert parents before children (two passes, or a single pass ordered so every parent row exists before its child references it).

---

# Ledger Group Service

Create

```text
src/modules/ledger-groups/services/ledger-group-service.ts
src/modules/ledger-groups/repositories/ledger-group-repository.ts
```

Responsibilities

- `seedDefaultGroups(companyId, tx)` — called from `companyService.createCompany()`'s transaction (accepts the transaction client so it participates in the same atomic unit of work)
- Create/Update(rename)/List/Activate/Deactivate, company-scoped per the Business Rules above
- List groups as a tree (parent → children) for the UI, and a flat lookup filtered by nature (consumed by `14-ledger-master.md`, `15-bank-management.md`, `16-expense-heads.md`, `17-income-heads.md`)

Business logic belongs here, following the Repository → Service → UI layering already established in every prior module.

---

# Validation

Use

Zod

Validate

- Name (required, min length, max 100 characters)
- Nature (required only when creating a top-level group — required enum, one of `ASSET`/`LIABILITY`/`INCOME`/`EXPENSE`)
- Affects Gross Profit (boolean, only accepted/relevant when Nature is `INCOME` or `EXPENSE`)
- Parent Group (optional; when present, Nature/Affects Gross Profit must not be supplied by the client — the server derives them from the parent, never trusts a client-supplied value that could disagree with the parent)

Provide meaningful validation messages.

---

# UI

Create

```text
src/app/accounting
src/app/accounting/ledger-groups
```

Pages

- Accounting Hub (`/accounting`) — new hub page mirroring `/masters` and `/settings`, linking to Ledger Groups (this feature) and, once implemented, Ledger Master/Bank Management/Expense Heads/Income Heads
- Ledger Group List (`/accounting/ledger-groups`, rendered as an expandable tree by parent/child, with each row's Nature shown as a badge)
- Create Ledger Group (`/accounting/ledger-groups/new`)
- Edit Ledger Group (`/accounting/ledger-groups/[id]/edit`)

Create reusable components

```text
src/modules/ledger-groups/components/
```

Examples

- Ledger Group Form (Nature/Affects Gross Profit fields only render when no parent is selected)
- Ledger Group Tree
- Ledger Group Selector (a parent-picker combobox; also reused by `14-ledger-master.md`'s Ledger Form to pick a Ledger's group)
- Account Nature Badge

---

# Navigation

Wire up the Sidebar's existing **Accounting** entry (`src/components/layout/sidebar.tsx`), which has carried no `href` since `03-Application-Shell.md` — add `href: "/accounting"`.

**Deliberate simplification**: gate its visibility the same coarse-grained way the existing `Masters`/`Settings` entries already do (`adminOnly: true`, filtered by the single `isAdmin` prop `Sidebar` already receives) — not a new per-module `assertPermission("accounting", "view")` nav-visibility check. Introducing that would require threading a new prop through `AppShell` and every one of its ~10 existing callers, which is out of scope for a master-data foundation feature. Actual authorization inside every `/accounting/*` route still uses `assertPermission("accounting", ...)` per the Security section below — only the Sidebar item's visibility toggle reuses the existing coarser convention. Revisit if a future phase wants per-module nav visibility generally (not just for Accounting).

---

# Security

Every Create/Edit/Activate/Deactivate action must call `assertPermission(user, "accounting", "create" | "edit" | "delete")` (`src/lib/permissions.ts`, added in `11-role-permissions.md`); list/detail reads call `assertPermission(user, "accounting", "view")`. The `"accounting"` module and all six actions already exist in the Permission catalog (`src/constants/permissions.ts`) — no catalog changes needed.

Per the Architecture Decisions entry formalizing this (2026-07-13, item 4): **do not** hardcode a new `assertAdministrator()`-style check. This is the first module built after that decision was recorded, so it must follow it from the start, unlike `12-branch-management.md`'s spec text (drafted one day earlier, before the decision existed).

All reads/writes must be scoped to the requesting user's own company (see Business Rules) — never accept a company id from the client.

---

# Database

New models: `LedgerGroup`, enum `AccountNature`. Extends `companyService.createCompany()` (`08-company-management.md`) to seed default groups — no changes to the `Company` model itself.

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

- Ledger Master, Bank Management, Expense Heads, Income Heads (`14`–`17`, next in this Accounting Foundation group)
- Voucher Engine, any Voucher type, ledger balances/postings
- Trial Balance, Profit & Loss, Balance Sheet, or any other report
- Editable `parentGroupId`/`natureType`/`affectsGrossProfit` on an existing group
- A generic per-module (`assertPermission`-based) Sidebar visibility system — see Navigation's deliberate simplification
- GST, Sales, Purchase, Inventory

Those belong to future implementation tasks.

---

# Success Criteria

Verify

- Creating a new company seeds exactly the 23 default groups listed above, correctly parented, all `isSystemDefined = true`, all `isActive = true`.
- A custom top-level group requires an explicit Nature; a custom sub-group inherits its parent's Nature/Affects Gross Profit and does not expose those as editable fields.
- System-defined groups cannot be renamed or deactivated; custom groups can be renamed (subject to per-company name uniqueness) and deactivated.
- A group with an active child cannot be deactivated.
- Ledger Groups are scoped to the active company only (a user cannot read or modify another company's groups).
- No group can be permanently deleted.
- The Sidebar's Accounting entry now links to `/accounting`.
- No TypeScript errors.
- No ESLint errors.

This spec, together with `14-ledger-master.md`, `15-bank-management.md`, `16-expense-heads.md`, and `17-income-heads.md`, completes `context/Phases/phase-tracker.md`'s Phase 2 **Accounting Foundation** group. Completing this spec alone does not complete that group, nor Phase 2 overall (Inventory Masters, Business Parties, Pricing, and Shared ERP Engines all remain undrafted).
