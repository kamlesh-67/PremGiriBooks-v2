# 08 - Company Management

## Goal

Implement the **Company Management** module for **Premgiri Books ERP**.

This module establishes the business identity that all ERP operations belong to.

Every transaction in the ERP must belong to a company.

The application supports **Multi-Company** architecture.

Do **not** implement Financial Year, Branch selection, Customers, Products, or Transactions in this task.

---

# Project Context

Before implementation, review

- PRD.md
- project-overview.md
- architecture-context.md
- business-rules.md
- code-standards.md
- ui-context.md
- ai-workflow-rules.md

Follow all documented architecture and coding standards.

---

# Module Responsibilities

The Company module is responsible for

- Company Master
- Company Profile
- Company Settings
- Company Logo
- Company Selection
- Current Company Context

The Company module is **not** responsible for

- Financial Years
- Branch Management
- User Management
- Authentication
- Accounting
- GST Transactions

---

# Features

Implement

- Create Company
- Edit Company
- View Company
- Activate Company
- Deactivate Company
- Company Selection

Do not implement delete.

Companies must never be permanently deleted.

---

# Company Information

Support the following information.

## Basic

- Company Name
- Legal Name
- Display Name
- Business Type

---

## Registration

- GSTIN
- PAN
- TAN (Optional)
- CIN (Optional)

---

## Contact

- Mobile Number
- Alternate Mobile
- Email
- Website

---

## Address

- Address Line 1
- Address Line 2
- City
- State
- District
- Country
- PIN Code

---

## Financial

- Currency
- Currency Symbol
- Decimal Places

---

## Branding

- Company Logo

Store only the file reference.

---

# Company Settings

Create a separate Company Settings section.

Support

- Default Theme
- Date Format
- Time Format
- Number Format
- Currency Format

Future settings will be added later.

---

# Company Selection

If multiple companies exist

Show a Company Selection screen immediately after login.

If only one company exists

Automatically select it.

The selected company becomes the active working context.

---

# Current Company

Create

```text
src/lib/current-company.ts
```

Responsibilities

- Get Current Company
- Set Current Company
- Validate Company
- Store Current Company

Future modules must use this helper.

Never query the database directly for the active company.

---

# Company Provider

Create

```text
src/components/providers/company-provider.tsx
```

Responsibilities

- Active Company
- Company Context
- Company Loading State

Future ERP modules consume company information from this provider.

---

# Company Service

Create

```text
src/modules/company/services/company-service.ts
```

Responsibilities

- Create Company
- Update Company
- Get Company
- List Companies
- Activate Company
- Deactivate Company

Business logic belongs here.

---

# Validation

Use

Zod

Validate

- Company Name
- GSTIN
- PAN
- Email
- Mobile Number
- PIN Code

Provide meaningful validation messages.

---

# UI

Create

```text
src/app/company
```

Pages

- Company List
- Create Company
- Edit Company

Create reusable components.

```text
src/modules/company/components/
```

Examples

- Company Form
- Company Card
- Company Selector
- Logo Upload

---

# Navigation

Add Company Management under

```text
Masters
```

Visible only to users with Administrator role.

> **Amended 2026-07-13**: Company Management is now split across two
> modules, per `architecture-Migration-Super-Admin-Administration.md`.
> Create/Edit-legal-info/Activate/Deactivate moved to `/administration/companies`
> (Super Admin only — `userType === "PLATFORM"`); the `/company` route
> under Masters is now Company Admin's read-only view of their own company
> plus operational settings (theme/date format/currency display/logo) —
> never legal/business info, and never another company's data.

---

# Logo Upload

Allow

- PNG
- JPG
- JPEG
- SVG

Store logos locally.

Do not implement cloud storage.

Maximum file size

5 MB

---

# Search

Support searching companies by

- Company Name
- GSTIN
- Mobile Number

---

# Status

Support

- Active
- Inactive

Inactive companies

- Cannot be selected
- Cannot receive new transactions

Historical data remains accessible.

---

# Security

Only Administrator users may

- Create Company
- Edit Company
- Activate Company
- Deactivate Company

Other users may only access companies assigned to them.

> **Amended 2026-07-13**: "Administrator" here means Super Admin
> (`userType === "PLATFORM"`), gated by `assertSuperAdmin()` — not a Role.
> `companyService.createCompany()` now runs the full spec workflow (Company
> → `TenantBootstrapService` → Company Admin User, one transaction, via
> `tenantBootstrapService.bootstrapTenant()`) instead of just seeding
> ledger groups/default ledger. A Company Admin's own company (view +
> operational settings only) is unaffected by this change.

---

# Database

Use the existing

Company

model.

Extend it only if required.

Do not introduce duplicate tables.

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

- Financial Years
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

Those belong to future implementation tasks.

---

# Success Criteria

Verify

- Companies can be created.
- Companies can be updated.
- Companies can be activated and deactivated.
- Company validation works.
- Company logo upload works.
- Company selection works after login.
- Current company helper works.
- Company provider supplies active company.
- No TypeScript errors.
- No ESLint errors.

After completion, the project should be ready for **09-financial-year-management.md**.
