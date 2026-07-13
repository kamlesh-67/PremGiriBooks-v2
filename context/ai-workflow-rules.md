# AI Development Workflow

## Approach

Build Premgiri Books ERP using a **Specification-Driven Development**
workflow.

Every implementation must follow the project documentation instead of
making assumptions.

The documentation hierarchy is:

    PRD.md
            ↓
    project-overview.md
            ↓
    architecture-context.md
            ↓
    business-rules.md
            ↓
    database-schema.md
            ↓
    api-contracts.md
            ↓
    code-standards.md
            ↓
    progress-tracker.md

AI agents must always use these documents as the single source of truth.

Never invent business behavior.

------------------------------------------------------------------------

# Development Principles

The project follows

-   Offline First
-   Modular Architecture
-   Domain Driven Design (DDD)
-   Voucher Driven Accounting
-   Document Driven Workflow
-   Engine Based Business Logic

Every implementation must preserve these principles.

------------------------------------------------------------------------

# Implementation Workflow

Every feature must follow this sequence.

    Requirement

    ↓

    Analysis

    ↓

    Business Rules

    ↓

    Database

    ↓

    Backend

    ↓

    Business Engine

    ↓

    API

    ↓

    UI

    ↓

    Testing

    ↓

    Documentation

    ↓

    Progress Update

Never skip steps.

------------------------------------------------------------------------

# Development Scope

Work on only one feature or subsystem at a time.

Examples

Good

-   Customer Module
-   Supplier Module
-   Product Module
-   Sales Invoice
-   Voucher Engine

Bad

-   Sales + Purchase + Reports
-   Customer + Inventory + Accounting

Small, testable changes are preferred.

------------------------------------------------------------------------

# Feature Development Order

New features must follow this order.

1.  Business Rules
2.  Database Design
3.  Repository Layer
4.  Service Layer
5.  Business Engine
6.  API
7.  User Interface
8.  Testing
9.  Documentation

Never start from the UI.

------------------------------------------------------------------------

# Business Rule Priority

Business Rules always override UI requirements.

Example

Wrong

    Sales Screen calculates GST

Correct

    Sales Screen

    ↓

    GST Engine

    ↓

    GST Calculation

The same applies to

-   Pricing
-   Inventory
-   Voucher Posting

------------------------------------------------------------------------

# Engine Usage Rules

Business calculations must always go through shared engines.

Pricing

↓

Pricing Engine

Inventory

↓

Inventory Engine

Accounting

↓

Voucher Engine

GST

↓

GST Engine

Reports

↓

Reporting Engine

Business logic must never be duplicated.

------------------------------------------------------------------------

# Module Boundaries

Every module owns its own responsibilities.

Customer Module

Responsible for

-   Customer Master
-   Customer Validation

Not responsible for

-   GST
-   Ledger Posting

Sales Module

Responsible for

-   Invoice Creation

Not responsible for

-   Inventory Calculation
-   Accounting
-   Pricing

Those belong to their respective engines.

------------------------------------------------------------------------

# Database Workflow

Before creating tables

AI must verify

-   Entity already exists?
-   Relationship already exists?
-   Can existing models be reused?

Avoid duplicate tables.

Prefer extending existing entities.

------------------------------------------------------------------------

# API Workflow

Every API must

1.  Validate Input
2.  Authenticate User
3.  Check Permissions
4.  Call Business Engine
5.  Save Transaction
6.  Return Response
7.  Log Errors

Never place business calculations inside APIs.

------------------------------------------------------------------------

# UI Workflow

Every screen must

-   Display Data
-   Validate Forms
-   Call APIs
-   Handle User Interaction

UI must never

-   Calculate GST
-   Calculate Margin
-   Calculate Stock
-   Create Ledger Entries

------------------------------------------------------------------------

# File Creation Rules

Create files only when needed.

Preferred structure

    modules/

    customers/

    suppliers/

    products/

    sales/

    purchase/

    inventory/

    accounting/

    gst/

    reports/

    settings/

Shared logic

    engines/

    voucher/

    pricing/

    inventory/

    gst/

    reporting/

Utilities

    lib/

    utils/

    hooks/

    types/

    repositories/

    services/

------------------------------------------------------------------------

# Refactoring Rules

When modifying existing code

AI must

-   Reuse existing modules
-   Remove duplicate logic
-   Improve readability
-   Preserve business behavior
-   Update tests if required

Avoid unnecessary rewrites.

------------------------------------------------------------------------

# Documentation Rules

Whenever architecture changes

Update

-   architecture-context.md

Whenever business behavior changes

Update

-   business-rules.md

Whenever feature scope changes

Update

-   PRD.md
-   project-overview.md

Whenever coding conventions change

Update

-   code-standards.md

Whenever implementation status changes

Update

-   progress-tracker.md

Documentation must always match implementation.

------------------------------------------------------------------------

# Handling Missing Requirements

AI must never invent requirements.

If information is missing

1.  Search existing documentation.
2.  Search business rules.
3.  Search architecture.
4.  If still missing

Add an open question to

    progress-tracker.md

Stop implementation until clarified.

------------------------------------------------------------------------

# Protected Components

Never modify

-   shadcn/ui components
-   Prisma generated files
-   Third-party libraries

Instead

Wrap

Extend

Compose

Never edit vendor code.

------------------------------------------------------------------------

# ERP Business Rules

The following rules are mandatory.

-   Every financial transaction generates vouchers.
-   Every stock movement creates inventory transactions.
-   Every invoice follows the document lifecycle.
-   Posted documents cannot be edited.
-   Reports are generated from vouchers.
-   Inventory quantities are never updated directly.
-   Pricing is calculated only by the Pricing Engine.
-   GST is calculated only by the GST Engine.
-   Accounting entries are created only by the Voucher Engine.

These rules are non-negotiable.

------------------------------------------------------------------------

# Offline First Rules

The application must work completely offline.

AI must never introduce dependencies that require internet connectivity
for

-   Login
-   Sales
-   Purchase
-   Inventory
-   Accounting
-   GST
-   Reports
-   Printing

Cloud services must remain optional.

------------------------------------------------------------------------

------------------------------------------------------------------------

# Git Workflow

Every implementation task must follow the Git workflow below before
making any code changes.

## Repository Synchronization

Before starting any implementation:

1.  Switch to the `main` branch.
2.  Pull the latest changes from GitHub.
3.  Ensure the local repository is up to date.
4.  Resolve any merge conflicts before proceeding.

``` bash
git checkout main
git pull origin main
```

------------------------------------------------------------------------

## Create Feature Branch

Create a dedicated branch for the feature being implemented.

Branch naming convention:

``` text
feature/<feature-name>
```

Examples

``` text
feature/ledger-groups
feature/product-management
feature/pricing-engine
feature/customer-management
```

Never implement directly on the `main` branch.

``` bash
git checkout -b feature/<feature-name>
```

------------------------------------------------------------------------

## Development

Implement only the current feature specification.

-   Keep changes limited to the current feature.
-   Follow the project architecture and coding standards.
-   Do not mix unrelated changes.
-   Ensure TypeScript, ESLint, and build checks pass.

------------------------------------------------------------------------

## Commit Changes

After implementation:

1.  Review the changes.
2.  Create a meaningful Conventional Commit.

Format

``` text
type(scope): short summary
```

Example

``` text
feat(ledger): implement ledger group management
```

------------------------------------------------------------------------

## Push to GitHub

Push the feature branch.

``` bash
git push -u origin feature/<feature-name>
```

Never push directly to `main`.

------------------------------------------------------------------------

## Pull Request Description

Prepare a Pull Request containing:

-   Summary
-   Features implemented
-   Files/modules affected
-   Database changes (if any)
-   Testing performed
-   Notes / follow-up work

------------------------------------------------------------------------

## Completion Checklist

Before marking the feature complete, verify:

-   Latest `main` was pulled before starting.
-   Dedicated feature branch was created.
-   Feature implemented successfully.
-   TypeScript passes.
-   ESLint passes.
-   Build succeeds.
-   Changes committed with a meaningful commit message.
-   Feature branch pushed to GitHub.
-   Pull Request title and description prepared.
-   `progress-tracker.md` updated.

# Code Quality Checklist

Before completing any feature

Verify

-   TypeScript strict mode passes.
-   No `any` types.
-   No duplicated business logic.
-   Module boundaries respected.
-   Engines reused.
-   Tests updated.
-   Documentation updated.

------------------------------------------------------------------------

# Before Moving To The Next Feature

Verify

1.  Feature works end-to-end.
2.  No architecture rules are violated.
3.  Business rules are followed.
4.  Documentation is updated.
5.  progress-tracker.md reflects the current implementation state.
6.  No duplicated code has been introduced.

Only then begin the next feature.

------------------------------------------------------------------------

# AI Decision Priority

Whenever AI encounters conflicting information, follow this order of
precedence.

    1. User Instructions
            ↓
    2. PRD.md
            ↓
    3. business-rules.md
            ↓
    4. architecture-context.md
            ↓
    5. project-overview.md
            ↓
    6. code-standards.md
            ↓
    7. Existing Code

If existing code conflicts with the documentation, prefer the documented
architecture and record the discrepancy in `progress-tracker.md` before
making changes.

------------------------------------------------------------------------

# Future Modules

The following modules are planned but must not be implemented until
explicitly scheduled.

-   Formula Management
-   Production Engine
-   Automotive Paint Mixing
-   Manufacturing
-   Cloud Synchronization
-   Mobile Application
-   GST Portal Integration
-   E-Invoice
-   E-Way Bill
-   AI Business Assistant

These modules should remain architecturally compatible but out of scope
for the MVP.v
