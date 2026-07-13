# 17 - Income Heads

## Goal

Implement **Income Heads** for **Premgiri Books ERP** — a simplified, scoped entry point onto Ledger Master (`14-ledger-master.md`) for non-sales income ledgers (interest received, rent received, commission received, and similar) every business needs from day one, without exposing the full generic Ledger Group picker.

Per `context/Phases/phase-tracker.md`'s Phase 2 — Core Business Foundation → Accounting Foundation, this is the fifth and final feature of this group and depends directly on Ledger Master.

**No new database table.** An Income Head *is* a `Ledger` (`14-ledger-master.md`) assigned to a group under "Direct Incomes" or "Indirect Incomes" — this task mirrors `16-expense-heads.md`'s pattern exactly, on the income side, per `ai-workflow-rules.md`'s Database Workflow ("verify entity already exists ... avoid duplicate tables ... prefer extending existing entities").

Do **not** implement the Voucher Engine or any financial report in this task.

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
- `13-ledger-groups.md` (the "Direct Incomes"/"Indirect Incomes" default groups this feature scopes to)
- `14-ledger-master.md` (the `Ledger` model and `ledgerService.createUnderGroup`/`listSelectable` this task reuses directly, with no schema changes)
- `16-expense-heads.md` (the identical scoped-Ledger-view pattern this task mirrors on the income side)

Follow all documented architecture and coding standards.

---

# Module Responsibilities

The Income Heads module is responsible for

- A scoped Create/Edit/View/Activate/Deactivate flow for Ledgers under "Direct Incomes"/"Indirect Incomes" (or a company's own custom sub-groups of either)
- A scoped list view showing only income-nature Ledgers

The Income Heads module is **not** responsible for

- Ledger Groups, generic Ledger Master (`13`, `14` — already implemented; this feature is a thin, scoped layer on top, not a replacement)
- "Sales Accounts" — deliberately out of scope (see Business Rules). Sales revenue belongs to the future Sales module (Phase 3/5), not to income heads.
- Expense Heads (`16-expense-heads.md`)
- Any Voucher, posting, or report

---

# Features

Implement

- Create Income Head
- Edit Income Head
- View Income Head
- Activate Income Head
- Deactivate Income Head

These are the identical underlying operations `14-ledger-master.md` already provides on `Ledger` — this task adds no new persistence, only a scoped UI and a scoped service query. Do not implement delete, for the same reason Ledger Master doesn't.

---

# Data Model

No schema changes. Uses the existing `Ledger` model (`14-ledger-master.md`) as-is.

---

# Business Rules

- **An Income Head's Ledger Group must be "Direct Incomes" or "Indirect Incomes", or a descendant of either** — validated server-side by walking the group's parent chain, exactly like `16-expense-heads.md`'s equivalent check. Never trust a client-supplied group id blindly.
- **"Sales Accounts" is deliberately excluded**, even though it also has `natureType = INCOME` and `affectsGrossProfit = true`. Per standard accounting convention, "Sales Accounts" is reserved for trading/sales revenue, conceptually distinct from other income heads — the future Sales module (Phase 3/5) will own that group's usage, not this feature.
- Every other Business Rule from `14-ledger-master.md` applies unchanged (name uniqueness per company, immutable group after creation, no permanent delete, company-scoped).

---

# Income Head Service

No new repository. Add to the existing `ledgerService` (`14-ledger-master.md`):

- `listIncomeHeads(companyId)` — Ledgers whose group is a descendant of "Direct Incomes" or "Indirect Incomes" (excluding "Sales Accounts" and its subtree)
- `createIncomeHead(input)` — thin wrapper over `ledgerService.createUnderGroup` that validates the chosen group against the rule above before delegating

Do not duplicate Ledger persistence logic in a new service — extend the existing one.

---

# Validation

Use

Zod

Same fields as `14-ledger-master.md`'s Ledger schema (Name, Opening Balance, Opening Balance Type, Description), plus:

- Ledger Group (required; server re-validates it is a descendant of "Direct Incomes" or "Indirect Incomes" and excludes "Sales Accounts")

---

# UI

Create

```text
src/app/accounting/income-heads
```

Pages

- Income Head List (`/accounting/income-heads`)
- Create Income Head (`/accounting/income-heads/new`)
- Edit Income Head (`/accounting/income-heads/[id]/edit`)

Reuse `14-ledger-master.md`'s Ledger Form component, passing a pre-filtered Ledger Group Selector (Direct/Indirect Incomes subtree only, "Sales Accounts" excluded) rather than building a new form from scratch.

Add a card for Income Heads to the `/accounting` hub page.

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

- Ledger Groups, Ledger Master, Bank Management, Expense Heads (`13`–`16`, already implemented)
- "Sales Accounts" ledger creation (belongs to the future Sales module)
- Any Voucher, posting, or report
- A new database table or repository — this feature is UI + scoped service query only

Those belong to future implementation tasks.

---

# Success Criteria

Verify

- The Ledger Group picker on the Income Head form only offers descendants of "Direct Incomes"/"Indirect Incomes", excluding "Sales Accounts".
- Income Heads list shows only Ledgers under those two groups.
- Creating, editing, activating, and deactivating an Income Head behaves identically to `14-ledger-master.md`'s general Ledger operations (same uniqueness, immutable-group, no-delete rules).
- No new Prisma model or migration was introduced.
- No TypeScript errors.
- No ESLint errors.

Feature-spec 17 (this spec) completes `context/Phases/phase-tracker.md`'s Phase 2 **Accounting Foundation** group (features 12–16 in that tracker: Ledger Groups, Ledger Master, Bank Management, Expense Heads, Income Heads = feature-specs 13–17 in this directory). Completing it does **not** complete Phase 2 overall — Inventory Masters, Business Parties, Pricing, and Shared ERP Engines all remain undrafted.
