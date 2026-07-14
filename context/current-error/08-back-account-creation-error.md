# Architecture Fix - Bank Account Module

## Goal

Fix all architectural issues in the Bank Account module without changing the intended functionality.

This task is a **refactoring and architecture alignment** task.

Do **not** add new business features.

Do **not** modify the database schema unless explicitly required to fix architectural inconsistencies.

The objective is to make the implementation fully compliant with the project architecture before future Accounting, Voucher, and Payment modules depend on it.

---

# Context

Before making any changes, review:

- project-overview.md
- architecture-context.md
- code-standards.md
- ai-architecture-decisions.md
- ai-workflow-rules.md
- progress-tracker.md
- 13-ledger-groups.md
- 14-ledger-master.md
- 15-bank-management.md

Understand the intended architecture first.

Do not implement assumptions.

---

# Verify Architecture

Review the entire Bank Account module.

Verify the following.

---

## Company Isolation

Every Bank Account must belong to exactly one company.

Never trust companyId received from the client.

Company context must always come from

currentCompany()

or

Company Provider.

Repository queries must automatically scope data.

---

## Repository Pattern

Business logic must never exist inside

- API Routes
- Server Actions
- React Components

Required layers

Repository

↓

Service

↓

UI

Repositories perform database operations only.

Services contain business rules.

---

## Ledger Integration

Each Bank Account must reference exactly one Ledger.

The Bank Account must never duplicate ledger information.

Examples that must NOT exist

- Opening Balance
- Ledger Name
- Ledger Code
- Ledger Type

These belong to Ledger Master.

Bank Account only stores bank-specific information.

---

## Current Company

Verify every operation uses

currentCompany()

Never accept

companyId

from request payloads.

---

## Authorization

Every mutation must verify permissions.

Required flow

Authenticate

↓

Resolve Company

↓

Check Permission

↓

Execute

↓

Audit Log

No mutation may bypass permission checks.

---

## Validation

Validate all inputs using Zod.

Validation must occur before business logic.

Meaningful validation messages should be returned.

---

## Transaction Safety

Any operation that creates or updates both

Ledger

and

Bank Account

must use a single Prisma transaction.

Rollback everything if any step fails.

---

## Error Handling

Return domain-specific errors.

Do not expose

- Prisma errors
- SQL errors
- Stack traces

---

## Naming

Ensure consistent naming.

Examples

bankRepository

bankService

BankForm

BankTable

Avoid inconsistent names like

bankAccountRepo

BankDataService

---

## UI Responsibilities

UI components should only

- Display data
- Collect input
- Call actions

No business rules.

No database access.

---

## API Responsibilities

API routes should

- Validate input
- Resolve session
- Call Service
- Return response

Nothing else.

---

## Database Access

All Prisma access must happen inside repositories.

No direct Prisma usage inside

- Components
- Services
- API routes

---

## Duplicate Logic

Remove duplicated validation.

Remove duplicated permission checks.

Remove duplicated company resolution.

Centralize reusable logic.

---

## Audit Logging

Verify important actions generate audit logs.

Required

- Create Bank
- Update Bank
- Activate
- Deactivate

---

## Performance

Review for unnecessary queries.

Prefer

- Repository methods
- Includes
- Transactions

Avoid repeated database calls.

---

## Code Quality

Verify

- Strict TypeScript
- No any
- No unused code
- No dead components
- No duplicated types

---

# Expected Outcome

The Bank Account module should fully comply with the project architecture.

It should become the reference implementation for future accounting modules.

No functionality should change.

Only architectural issues should be corrected.

---

# Deliverables

After completion provide:

## Architecture Fix Summary

List every architectural issue that was found.

Explain why it violated the architecture.

Describe how it was fixed.

---

## Files Changed

List every modified file.

Briefly describe each change.

---

## Verification Checklist

Confirm:

- Company isolation enforced
- Repository → Service → UI respected
- Permission checks verified
- Ledger integration preserved
- No duplicate logic remains
- Transaction safety verified
- Audit logging preserved
- No TypeScript errors
- No ESLint errors
- Build passes successfully

Do not implement new features during this task.

Only resolve architectural issues and inconsistencies.
