
# Code Standards

## General

- Keep modules small, focused, and single-purpose.
- Fix root causes instead of applying temporary workarounds.
- Never duplicate business logic across modules.
- Respect the boundaries defined in `architecture-context.md`.
- Follow Domain-Driven Design (DDD) principles wherever practical.
- Business rules must remain independent from UI components.
- Every feature must be modular and reusable.

---

# TypeScript

- Enable strict mode throughout the project.
- Never use `any`.
- Prefer explicit interfaces over implicit object types.
- Use `interface` for business entities.
- Use `type` only for unions, utility types, and mapped types.
- Validate all external input before processing.
- Use readonly types whenever mutation is not required.

---

# React & Next.js

- Prefer React Server Components where applicable.
- Use `"use client"` only when browser interaction is required.
- Keep components small and reusable.
- Never place business logic inside UI components.
- UI components should only display data and emit events.
- Prefer composition over inheritance.

---

# UI Standards

- Use shadcn/ui components whenever possible.
- Use Tailwind utility classes consistently.
- Never hardcode colors.
- Use design tokens from `globals.css`.
- Maintain consistent spacing throughout the application.
- Keep layouts responsive.
- Support keyboard-first navigation.
- Minimize mouse dependency for billing screens.

---

# Business Logic

Business logic must never exist inside

- React Components
- Pages
- Dialogs
- Forms
- Route Handlers

Business logic belongs only inside

- Voucher Engine
- Pricing Engine
- Inventory Engine
- GST Engine
- Reporting Engine

---

# Engine Rules

## Voucher Engine

Responsible for

- Journal Entries
- Ledger Posting
- Financial Transactions

No other module may directly update ledgers.

---

## Pricing Engine

Responsible for

- Selling Price
- Margin Calculation
- Discount Rules
- Customer Pricing
- Price Lists

No screen may calculate selling prices directly.

---

## Inventory Engine

Responsible for

- Stock Movement
- Stock Validation
- Warehouse Operations
- Stock Adjustment

Inventory calculations must remain centralized.

---

## GST Engine

Responsible for

- GST Calculation
- Tax Validation
- GST Reports

No module may manually calculate GST.

---

# API Standards

- Validate every request.
- Validate user permissions before execution.
- Keep APIs thin.
- Delegate business logic to services.
- Return consistent response structures.
- Never expose internal exceptions to users.
- Log unexpected errors.

---

# Database Standards

- PostgreSQL is the single source of truth.
- Prisma is the only ORM.
- Never write raw SQL unless absolutely necessary.
- Use transactions for financial operations.
- Use foreign keys for relationships.
- Use UUIDs for public identifiers where appropriate.
- Soft delete business records when required.
- Never permanently delete financial data.

---

# Financial Rules

Financial data is immutable.

Rules

- Posted vouchers cannot be edited.
- Cancelled vouchers create reversal entries.
- Ledger balances are never manually updated.
- Trial Balance is generated from vouchers.
- Profit & Loss is generated from vouchers.
- Balance Sheet is generated from vouchers.

---

# Inventory Rules

- Inventory movements must always create stock transactions.
- Stock quantity must never be updated directly.
- Current stock is calculated from stock transactions.
- Opening stock must be recorded through opening vouchers.
- Negative stock depends on company settings.

---

# GST Rules

- GST must always be calculated by the GST Engine.
- Place of Supply determines GST type.
- HSN Code is mandatory where applicable.
- GST reports derive data from vouchers.
- Manual GST adjustment must be auditable.

---

# Pricing Rules

- Latest Purchase Cost is the default costing method.
- Margin Profiles generate selling prices.
- Customer-specific pricing overrides default pricing.
- Manual price override requires permission.
- Selling below cost requires warning or approval.
- Selling below minimum margin requires permission.

---

# Authentication & Authorization

- Every user must authenticate before accessing the system.
- Every action must respect Role-Based Access Control (RBAC).
- Company data must remain isolated.
- Branch permissions must be enforced.
- Sensitive actions require explicit permissions.

---

# Offline-First Rules

The application must function completely offline.

Business operations must never depend on internet connectivity.

Examples

- Sales
- Purchase
- Inventory
- Accounting
- GST
- Reports
- Printing

Cloud services must always remain optional.

---

# File Organization

```
src/

app/
components/
modules/
engines/
services/
repositories/
database/
lib/
hooks/
types/
utils/
config/
constants/
```

Module Structure

```
modules/

sales/
purchase/
inventory/
accounting/
gst/
customers/
suppliers/
products/
employees/
reports/
settings/
```

Engine Structure

```
engines/

voucher/
pricing/
inventory/
gst/
reporting/
```

---

# Naming Conventions

Components

```
SalesInvoiceForm.tsx
CustomerSelector.tsx
ProductSearch.tsx
```

Services

```
SalesService.ts
PricingService.ts
VoucherService.ts
```

Repositories

```
ProductRepository.ts
CustomerRepository.ts
```

Interfaces

```
Customer.ts
Product.ts
Voucher.ts
```

Enums

```
VoucherType.ts
PaymentMode.ts
GSTType.ts
```

---

# Logging

Log

- Authentication
- Financial Transactions
- Stock Movement
- Errors
- Failed Login Attempts
- Data Import
- Data Export

Do not log

- Passwords
- Sensitive Tokens
- Personal Secrets

---

# Testing

Every business engine must include

- Unit Tests
- Integration Tests

Critical flows

- Sales
- Purchase
- Payment
- GST
- Inventory
- Financial Reports

must be covered before release.

---

# Performance

Goals

- Dashboard < 2 seconds
- Invoice Save < 1 second
- Product Search < 300ms
- Customer Search < 300ms
- Report Generation < 5 seconds

Large reports should support pagination.

---

# AI Development Rules

AI agents must

- Reuse existing modules before creating new ones.
- Never duplicate business rules.
- Follow module boundaries.
- Keep engines independent.
- Keep UI free from business logic.
- Update documentation when introducing architectural changes.
- Generate production-ready TypeScript.
- Prefer readability over clever implementations.

---

# Code Review Checklist

Every pull request must verify

- No duplicated business logic.
- TypeScript strict mode passes.
- No `any` types.
- No hardcoded business rules in UI.
- Financial calculations use Voucher Engine.
- Pricing calculations use Pricing Engine.
- GST calculations use GST Engine.
- Inventory updates use Inventory Engine.
- Tests pass.
- Documentation updated if architecture changes.