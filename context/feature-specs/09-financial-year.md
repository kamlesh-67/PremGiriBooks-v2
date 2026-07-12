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
- Start Date and End Date are calendar-day boundaries and both **inclusive** — a Financial Year covers every calendar day from Start Date through End Date, End Date's day included. Store each as that calendar day's midnight (`00:00:00`); comparisons for overlap/adjacency below are on the calendar day, not the raw timestamp.
- A new Financial Year's date range must not overlap any existing Financial Year for the same company: two ranges overlap when `newStart <= existingEnd AND newEnd >= existingStart`. Directly adjacent ranges are **not** overlaps and are valid — e.g. `2026-04-01..2027-03-31` followed immediately by `2027-04-01..2028-03-31` is allowed, since the first year's inclusive End Date (2027-03-31) falls one full calendar day before the second year's inclusive Start Date (2027-04-01).
- Exactly one Financial Year per company may have `isCurrent = true`, enforced at two levels so concurrent requests can never leave two rows current:
  - **Database**: add a hand-written partial unique index via a Prisma migration (`prisma migrate dev --create-only`, then edit the generated SQL — Prisma's schema DSL has no partial/conditional `@@unique`): `CREATE UNIQUE INDEX "financial_year_company_current_idx" ON "FinancialYear" ("companyId") WHERE "isCurrent" = true;`. This is the authoritative guarantee even if the service logic below has a bug.
  - **Service**: `financialYearService.setCurrent` must clear the previous current year and set the new one inside a single Prisma `$transaction`, using either `Serializable` isolation (`{ isolationLevel: Prisma.TransactionIsolationLevel.Serializable }`) or an explicit row lock (`SELECT ... FOR UPDATE` on the company's current row) so two concurrent `setCurrent` calls for the same company cannot both succeed. Catch the resulting serialization failure (Postgres `40001`) or unique-violation (`23505`, from the partial index) and retry the transaction a small, bounded number of times before surfacing a clean "financial year was changed by another request, please retry" error — never let the raw Postgres error reach the UI. A bare check-then-set (read the current row, then two separate `update` calls with no transaction/isolation/locking) is exactly the race this rule exists to prevent and must not be used.
- A closed Financial Year (`isClosed = true`) cannot be edited, cannot be set as current, and cannot be reopened in this task. Reopening is out of scope.
- Closing the **current** Financial Year (a row where `isCurrent` and the target `isClosed` are both true before the operation) must, in the same transaction as setting `isClosed = true`, also clear `isCurrent` on that row — a closed year must never remain `isCurrent`. `financialYearService.closeFinancialYear` must then:
  - If exactly one other open (`isClosed = false`) Financial Year exists for the company, automatically promote it to `isCurrent` (same transaction/locking discipline as `setCurrent` above).
  - If zero or more than one other open Financial Year exists, do not guess which one to promote — clear the active Financial Year cookie (`clearCurrentFinancialYear()`) and let the request fall through to the Financial Year Selection screen (see below) so the user picks explicitly.
  - Either way, the active Financial Year context (cookie and provider) must never be left pointing at the just-closed year, even for the remainder of the current request.
- Only Administrator users may Create, Edit, Set Current, or Close a Financial Year.

---

# Financial Year Selection

Mirror the existing Company Selection flow (`08-company-management.md`):

- After a Company is selected (`getCurrentCompany()` resolves), check whether the company has any Financial Years.
- If none exist, redirect to a "Create Financial Year" screen — the company is not yet operational without one.
- If exactly one exists, or one is marked `isCurrent`, auto-select it.
- If multiple exist and none is current, show a Financial Year Selection screen.
- The selected Financial Year becomes part of the active working context alongside the active Company.

This same flow is re-entered whenever the active Financial Year is closed and no single open year could be auto-promoted (see the closing-the-current-year rule above) — the cookie has already been cleared at that point, so the existing "no current Financial Year" branch above handles it without new logic.

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
