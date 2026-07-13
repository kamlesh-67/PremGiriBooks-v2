# 16 - Expense Heads

## Goal

Implement **Expense Heads** for **Premgiri Books ERP** — a simplified, scoped entry point onto Ledger Master (`14-ledger-master.md`) for the day-to-day operating-expense ledgers (rent, salaries, electricity, stationery, and similar) every business needs from day one, without exposing the full generic Ledger Group picker.

Per `context/Phases/phase-tracker.md`'s Phase 2 — Core Business Foundation → Accounting Foundation, this is the fourth of five features and depends directly on Ledger Master.

**No new database table.** An Expense Head *is* a `Ledger` (`14-ledger-master.md`) assigned to a group under "Direct Expenses" or "Indirect Expenses" — this task adds a purpose-built, pre-filtered UI and a scoped service query on top of the existing `Ledger` model, per `ai-workflow-rules.md`'s Database Workflow ("verify entity already exists ... avoid duplicate tables ... prefer extending existing entities").

Do **not** implement Income Heads, the Voucher Engine, or any financial report in this task.

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
- `13-ledger-groups.md` (the "Direct Expenses"/"Indirect Expenses" default groups this feature scopes to)
- `14-ledger-master.md` (the `Ledger` model and `ledgerService.createUnderGroup`/`listSelectable` this task reuses directly, with no schema changes)

Follow all documented architecture and coding standards.

---

# Module Responsibilities

The Expense Heads module is responsible for

- A scoped Create/Edit/View/Activate/Deactivate flow for Ledgers under "Direct Expenses"/"Indirect Expenses" (or a company's own custom sub-groups of either)
- A scoped list view showing only expense-nature Ledgers

The Expense Heads module is **not** responsible for

- Ledger Groups, generic Ledger Master (`13`, `14` — already implemented; this feature is a thin, scoped layer on top, not a replacement)
- "Purchase Accounts" — deliberately out of scope (see Business Rules). Trading purchases belong to the future Purchase module (Phase 4/6), not to operating expense heads.
- Income Heads (`17-income-heads.md`)
- Any Voucher, posting, or report

---

# Features

Implement

- Create Expense Head
- Edit Expense Head
- View Expense Head
- Activate Expense Head
- Deactivate Expense Head

These are the identical underlying operations `14-ledger-master.md` already provides on `Ledger` — this task adds no new persistence, only a scoped UI and a scoped service query. Do not implement delete, for the same reason Ledger Master doesn't.

---

# Data Model

No schema changes. Uses the existing `Ledger` model (`14-ledger-master.md`) as-is.

---

# Business Rules

- **An Expense Head's Ledger Group must be "Direct Expenses" or "Indirect Expenses", or a descendant of either** — validated server-side by walking the group's parent chain, exactly like `15-bank-management.md`'s equivalent check for "Bank Accounts". Never trust a client-supplied group id blindly.
- **"Purchase Accounts" is deliberately excluded**, even though it also has `natureType = EXPENSE` and `affectsGrossProfit = true`. Per standard accounting convention, "Purchase Accounts" is reserved for trading/cost-of-goods purchases, conceptually distinct from operating expense heads — the future Purchase module (Phase 4/6) will own that group's usage, not this feature.
- Every other Business Rule from `14-ledger-master.md` applies unchanged (name uniqueness per company, immutable group after creation, no permanent delete, company-scoped).

---

# Expense Head Service

No new repository. Add to the existing `ledgerService` (`14-ledger-master.md`):

- `listExpenseHeads(companyId)` — Ledgers whose group is a descendant of "Direct Expenses" or "Indirect Expenses" (excluding "Purchase Accounts" and its subtree)
- `createExpenseHead(input)` — thin wrapper over `ledgerService.createUnderGroup` that validates the chosen group against the rule above before delegating

Do not duplicate Ledger persistence logic in a new service — extend the existing one.

---

# Validation

Use

Zod

Same fields as `14-ledger-master.md`'s Ledger schema (Name, Opening Balance, Opening Balance Type, Description), plus:

- Ledger Group (required; server re-validates it is a descendant of "Direct Expenses" or "Indirect Expenses" and excludes "Purchase Accounts")

---

# UI

Create

```text
src/app/accounting/expense-heads
```

Pages

- Expense Head List (`/accounting/expense-heads`)
- Create Expense Head (`/accounting/expense-heads/new`)
- Edit Expense Head (`/accounting/expense-heads/[id]/edit`)

Reuse `14-ledger-master.md`'s Ledger Form component, passing a pre-filtered Ledger Group Selector (Direct/Indirect Expenses subtree only, "Purchase Accounts" excluded) rather than building a new form from scratch.

Add a card for Expense Heads to the `/accounting` hub page.

---

# Security

Every Create/Edit/Activate/Deactivate action must call `assertPermission(user, "accounting", "create" | "edit" | "delete")`; list/detail reads call `assertPermission(user, "accounting", "view")` — same as every other feature in this group, no new permission catalog entries needed.

All reads/writes must be scoped to the requesting user's own company — never accept a company id from the client.

---

# Database

No new models, no schema changes.

---

# Code Standards

Follow

- architecture-context.md
- code-standards.md

Requirements

- Strict TypeScript
- No `any`
- Reuse `ledgerService` — no duplicated Ledger persistence logic
- No business logic in components
- Repository → Service → UI architecture

---

# Do Not

Do not implement

- Ledger Groups, Ledger Master, Bank Management (`13`–`15`, already implemented)
- Income Heads (`17`, next and last in this Accounting Foundation group)
- "Purchase Accounts" ledger creation (belongs to the future Purchase module)
- Any Voucher, posting, or report
- A new database table or repository — this feature is UI + scoped service query only

Those belong to future implementation tasks.

---

# Success Criteria

Verify

- The Ledger Group picker on the Expense Head form only offers descendants of "Direct Expenses"/"Indirect Expenses", excluding "Purchase Accounts".
- Expense Heads list shows only Ledgers under those two groups.
- Creating, editing, activating, and deactivating an Expense Head behaves identically to `14-ledger-master.md`'s general Ledger operations (same uniqueness, immutable-group, no-delete rules).
- No new Prisma model or migration was introduced.
- No TypeScript errors.
- No ESLint errors.

Feature-spec 16 (this spec) falls under `context/Phases/phase-tracker.md`'s Accounting Foundation group. Completing it does not complete that group — `17-income-heads.md` remains undrafted-but-planned/drafted-but-not-implemented, per whichever this file's own status is by the time you read this.
