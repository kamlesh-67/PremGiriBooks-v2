# 15 - Bank Management

## Goal

Implement **Bank Management** for **Premgiri Books ERP** — company bank accounts, modeled as a Ledger (`14-ledger-master.md`) under the reserved "Bank Accounts" group plus a small set of bank-specific detail fields (account number, IFSC, branch, account type) that a generic Ledger has no room for.

Per `context/Phases/phase-tracker.md`'s Phase 2 — Core Business Foundation → Accounting Foundation, this is the third of five features and depends directly on Ledger Master.

Do **not** implement Expense Heads, Income Heads, the Voucher Engine, Payment/Receipt/Contra Vouchers, bank reconciliation, or bank statement import in this task.

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
- `13-ledger-groups.md` (the reserved "Bank Accounts" group this feature creates Ledgers under)
- `14-ledger-master.md` (the `Ledger` model, `ledgerService.createUnderGroup`, and the Ledger Selector this task builds on — and the rule that Ledger Master's own generic Create screen deliberately excludes "Bank Accounts")

Follow all documented architecture and coding standards.

---

# Module Responsibilities

The Bank Management module is responsible for

- Bank Account Master (Create/Edit/View/Activate/Deactivate, scoped to the active company)
- The only path by which a Ledger under "Bank Accounts" (or a descendant of it) may be created

The Bank Management module is **not** responsible for

- Ledger Groups or generic Ledger Master (`13`, `14` — already implemented)
- Bank reconciliation, bank statement import, cheque management, or online banking integration (all Phase 12 — Future Features)
- Payment Voucher, Receipt Voucher, Contra Voucher (Phase 6 — Accounting; these will debit/credit a bank Ledger once the Voucher Engine exists, not built here)

---

# Features

Implement

- Create Bank Account
- Edit Bank Account
- View Bank Account
- Activate Bank Account
- Deactivate Bank Account

Do not implement delete. Matching every other master in this codebase, Bank Accounts (and their underlying Ledger) are never permanently deleted.

---

# Data Model

Add to `prisma/schema.prisma`:

```text
enum BankAccountType {
  SAVINGS
  CURRENT
  CASH_CREDIT
  OVERDRAFT
}

model BankAccount {
  id                 String          @id @default(uuid())
  companyId          String
  company            Company         @relation(fields: [companyId], references: [id])
  ledgerId           String          @unique
  ledger             Ledger          @relation(fields: [ledgerId], references: [id])
  bankName           String
  accountNumber      String
  ifscCode           String
  branchName         String
  accountHolderName  String
  accountType        BankAccountType @default(CURRENT)
  upiId              String?
  isActive           Boolean         @default(true)
  createdAt          DateTime        @default(now())
  updatedAt          DateTime        @updatedAt

  @@unique([companyId, accountNumber])
  @@index([companyId])
}
```

`BankAccount.companyId` duplicates `ledger.companyId` — a deliberate denormalization, matching every other model's direct `companyId` column in this codebase (Branch, User, Ledger, LedgerGroup), kept in sync only because `BankAccount` and its `Ledger` are always created and updated together in the same transaction (see below), never independently.

`BankAccount` is a strict 1:1 extension of `Ledger` (`ledgerId @unique`) — the display name, opening balance, and active/inactive state live on the `Ledger` row; `BankAccount` only adds the fields a generic Ledger has no room for.

---

# Business Rules

- Creating a Bank Account transactionally creates **both** the underlying `Ledger` (name = the account's display name, e.g. "HDFC Bank - 1234", assigned to the "Bank Accounts" group or one of its descendants) **and** the `BankAccount` row referencing it, in one transaction. Neither can exist without the other.
- **The Ledger Group chosen for a Bank Account's underlying Ledger must be "Bank Accounts" or a descendant of it** — validated server-side by walking the group's parent chain, never trusting a client-supplied group id blindly. If the company has created no custom sub-groups under "Bank Accounts" (`13-ledger-groups.md`), the group is simply "Bank Accounts" itself with no picker shown.
- Editing a Bank Account updates both the `BankAccount` detail fields and the underlying Ledger's name/description/opening balance through one combined form, in one transaction.
- **Deactivating a Bank Account deactivates both the `BankAccount` row and its underlying `Ledger` together**, in one transaction — a Bank Ledger with no active `BankAccount` detail (or vice versa) is an inconsistent state this task must never produce. There is no way to deactivate "just the Ledger half" or "just the detail half."
- Account Number is unique within a company (`@@unique([companyId, accountNumber])`) — a company should not register the same account number twice.
- No permanent delete — Activate/Deactivate only (of both rows together, per above).
- **Company-scoped for every user**, per the same Architecture Decision `13-ledger-groups.md`/`14-ledger-master.md` apply.

---

# Bank Service

Create

```text
src/modules/bank-accounts/services/bank-account-service.ts
src/modules/bank-accounts/repositories/bank-account-repository.ts
```

Responsibilities

- Create/Update/List/Activate/Deactivate, always operating on the `BankAccount` + `Ledger` pair together inside one transaction (reusing `14-ledger-master.md`'s `ledgerService.createUnderGroup`/update primitives, not duplicating Ledger-write logic)
- Validate the chosen Ledger Group is "Bank Accounts" or a descendant of it

Business logic belongs here, following the Repository → Service → UI layering already established in every prior module.

---

# Validation

Use

Zod

Validate

- Account Display Name (the underlying Ledger's name — required, min length, max 100 characters, unique per company)
- Bank Name (required)
- Account Number (required, numeric, unique per company)
- IFSC Code (required, standard 11-character IFSC format: 4 letters, `0`, 6 alphanumeric)
- Branch Name (required)
- Account Holder Name (required)
- Account Type (required enum: Savings/Current/Cash Credit/Overdraft)
- UPI ID (optional, standard `name@handle` format when present)
- Opening Balance / Opening Balance Type (same as `14-ledger-master.md`'s Ledger fields — required, defaults 0/Debit)

Provide meaningful validation messages.

---

# UI

Create

```text
src/app/accounting/banks
```

Pages

- Bank Account List (`/accounting/banks`)
- Create Bank Account (`/accounting/banks/new`)
- Edit Bank Account (`/accounting/banks/[id]/edit`)

Create reusable components

```text
src/modules/bank-accounts/components/
```

Examples

- Bank Account Form (combines the Ledger fields — Display Name, Opening Balance/Type — with the bank-specific fields in one form)
- Bank Account Table
- Bank Account Status Badge

Add a card for Bank Management to the `/accounting` hub page.

---

# Security

Every Create/Edit/Activate/Deactivate action must call `assertPermission(user, "accounting", "create" | "edit" | "delete")`; list/detail reads call `assertPermission(user, "accounting", "view")` — same as `13`/`14`, no new permission catalog entries needed.

All reads/writes must be scoped to the requesting user's own company — never accept a company id from the client.

---

# Database

New model: `BankAccount`, enum `BankAccountType`. No changes to `Company`, `LedgerGroup`, or `Ledger`.

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

- Ledger Groups, Ledger Master (`13`, `14`, already implemented)
- Expense Heads, Income Heads (`16`, `17`, next in this Accounting Foundation group)
- Bank Reconciliation, Bank Statement Import, Cheque Management, Online Banking Integration (Phase 12 — Future Features)
- Payment Voucher, Receipt Voucher, Contra Voucher, or any Voucher Engine capability
- GST, Sales, Purchase, Inventory

Those belong to future implementation tasks.

---

# Success Criteria

Verify

- Creating a Bank Account creates exactly one `Ledger` (under "Bank Accounts" or a descendant) and one `BankAccount` row, atomically.
- The Ledger Group picker only offers "Bank Accounts" and its descendants.
- Deactivating a Bank Account deactivates both rows together; no Bank Ledger can exist active while its `BankAccount` is inactive, or vice versa.
- Account Number is unique per company; IFSC format is validated.
- Bank Accounts are scoped to the active company only.
- No Bank Account can be permanently deleted.
- No TypeScript errors.
- No ESLint errors.

Feature-spec 15 (this spec) falls under `context/Phases/phase-tracker.md`'s Accounting Foundation group. Completing it does not complete that group — `16-expense-heads.md` and `17-income-heads.md` remain undrafted-but-planned/drafted-but-not-implemented, per whichever this file's own status is by the time you read this.
