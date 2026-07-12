# 09 - Financial Year Management

## Goal

Implement the **Financial Year Management** module for **Premgiri Books ERP**.

Every accounting operation belongs to a Financial Year, scoped to the active Company.

This task establishes Financial Year Master, Financial Year selection, and the current-financial-year context helper future accounting/transaction modules must reuse.

Do **not** implement Branch selection, Users, Roles, Customers, Products, Vouchers, or any transactional module in this task.

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

Follow all documented architecture and coding standards.

---

# Module Responsibilities

The Financial Year module is responsible for

- Financial Year Master
- Financial Year Selection
- Current Financial Year Context
- Financial Year Closing (flag only)

The Financial Year module is **not** responsible for

- Branch Management
- User Management
- Accounting Entries
- Year-End Closing Vouchers
- Opening Balance Carry-Forward

Carry-forward and closing vouchers depend on the Voucher Engine, which does not exist yet. This task only introduces the record and the lock flag; the accounting consequences of closing a year are future work.

---

# Features

Implement

- Create Financial Year
- Edit Financial Year
- View Financial Year
- Set Current Financial Year
- Close Financial Year
- Financial Year Selection

Do not implement delete.

Financial Years must never be permanently deleted.

---

# Financial Year Information

Use the existing `FinancialYear` model created during Database Foundation (`companyId`, `name`, `startDate`, `endDate`, `isCurrent`, `isClosed`). Extend it only if a field is genuinely missing — do not introduce duplicate tables.

Support

- Name (e.g. `2026-2027`)
- Start Date
- End Date
- Current flag
- Closed flag

---

# Business Rules

- A Financial Year belongs to exactly one Company (`companyId`, already enforced by the schema).
- `name` must be unique per company (already enforced by `@@unique([companyId, name])`).
- Start Date must be strictly before End Date.
- A new Financial Year's date range must not overlap any existing Financial Year for the same company.
- Exactly one Financial Year per company may have `isCurrent = true`. This is **not** a database constraint (Prisma has no partial/conditional unique index) — enforce it in `financialYearService.setCurrent` with a check-then-set transaction that clears the previous current year before setting the new one.
- A closed Financial Year (`isClosed = true`) cannot be edited, cannot be set as current, and cannot be reopened in this task. Reopening is out of scope.
- Only Administrator users may Create, Edit, Set Current, or Close a Financial Year.

---

# Financial Year Selection

Mirror the existing Company Selection flow (`08-company-management.md`):

- After a Company is selected (`getCurrentCompany()` resolves), check whether the company has any Financial Years.
- If none exist, redirect to a "Create Financial Year" screen — the company is not yet operational without one.
- If exactly one exists, or one is marked `isCurrent`, auto-select it.
- If multiple exist and none is current, show a Financial Year Selection screen.
- The selected Financial Year becomes part of the active working context alongside the active Company.

---

# Current Financial Year

Create

```text
src/lib/current-financial-year.ts
```

Responsibilities

- Get Current Financial Year
- Set Current Financial Year
- Clear Current Financial Year
- Validate Financial Year belongs to the active Company

Follow the exact read/write split already established in `src/lib/current-company.ts`: reads (`getCurrentFinancialYear`/`getCurrentFinancialYearId`) are safe from any Server Component; writes (`setCurrentFinancialYear`/`clearCurrentFinancialYear`) must only run inside a Server Action, never during render. Use a separate httpOnly cookie (do not overload the company cookie).

Future modules must use this helper. Never query the database directly for the active financial year.

---

# Financial Year Provider

Create

```text
src/components/providers/financial-year-provider.tsx
```

Responsibilities

- Active Financial Year
- Financial Year Context
- Financial Year Loading State

Wire into the root layout the same way `CompanyProvider` was wired in `08-company-management.md` — server-resolved, passed as `initialFinancialYear`, no client-side fetch.

Wire the Status Bar's existing "FY" placeholder field (`status-bar.tsx`) to the real current financial year name, the same way its "Company" field was wired.

---

# Financial Year Service

Create

```text
src/modules/financial-year/services/financial-year-service.ts
```

Responsibilities

- Create Financial Year
- Update Financial Year
- Get Financial Year
- List Financial Years (scoped to a company)
- Set Current Financial Year
- Close Financial Year

Business logic belongs here, following the Repository → Service → UI layering already established in the Company module.

---

# Validation

Use

Zod

Validate

- Name (required)
- Start Date (required, valid date)
- End Date (required, valid date, after Start Date)

Provide meaningful validation messages.

---

# UI

Create

```text
src/app/financial-year
```

Pages

- Financial Year List (scoped to the active company)
- Create Financial Year
- Edit Financial Year

Create reusable components

```text
src/modules/financial-year/components/
```

Examples

- Financial Year Form
- Financial Year Selector
- Financial Year Card

---

# Navigation

Add Financial Year Management under

```text
Masters
```

alongside Company Management, following the same placement already established in `08-company-management.md`.

Visible only to users with Administrator role.

---

# Security

Only Administrator users may

- Create Financial Year
- Edit Financial Year
- Set Current Financial Year
- Close Financial Year

Other users may only view and select from the Financial Years belonging to their own company, following the same non-admin scoping pattern used in `companyService.listCompanies`/`getCompany`.

---

# Database

Use the existing

FinancialYear

model.

Extend it only if required. Do not introduce duplicate tables.

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

- Branches
- Warehouses
- Users
- Roles
- Customers
- Suppliers
- Products
- Sales
- Purchase
- Accounting
- GST
- Reports
- Year-end closing vouchers
- Opening balance carry-forward
- Reopening a closed Financial Year

Those belong to future implementation tasks.

---

# Success Criteria

Verify

- Financial Years can be created, scoped to the active company.
- Financial Years can be updated while not closed.
- Overlapping date ranges are rejected.
- Only one Financial Year per company can be current at a time.
- Closing a Financial Year prevents further edits.
- Financial Year selection works after Company selection.
- Current Financial Year helper works.
- Financial Year provider supplies the active financial year.
- Status Bar shows the real current financial year.
- No TypeScript errors.
- No ESLint errors.

After completion, the project should be ready for **10-user-management.md**.
