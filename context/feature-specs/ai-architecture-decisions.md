# AI Architecture Decisions

> This document contains permanent architectural decisions for Premgiri Books ERP.
>
> Every AI implementation task MUST follow these decisions.
>
> If any feature specification conflicts with this document, this document takes precedence until it is intentionally updated.
>
> AI should never introduce an alternative architecture without explicitly updating this file.

---

# Current Architecture Version

Version: 1.0

Last Updated: YYYY-MM-DD

---

# Core Principles

The ERP is designed as a modular, offline-first, multi-tenant business application.

Every implementation must prioritize:

- Security
- Data isolation
- Reusability
- Modularity
- Auditability
- Performance
- Future scalability

Never implement shortcuts that make future modules harder to build.

---

# Multi-Tenant Architecture

The application uses a shared PostgreSQL database.

Every business record belongs to exactly one company.

Every business table MUST contain

- companyId
- createdAt
- updatedAt
- createdBy (when applicable)
- updatedBy (when applicable)

No business entity may exist without a company.

Examples

✓ Ledger

✓ Customer

✓ Supplier

✓ Product

✓ Voucher

✓ Invoice

✓ Bank

✓ Warehouse

✓ Employee

---

# Tenant Isolation

Company data must never be mixed.

Every database query must automatically scope data using

currentCompanyId

Never trust a companyId received from the client.

Always derive company context from the authenticated session.

Correct

where:
{
companyId: currentCompany.id
}

Never

where:
{
companyId: request.companyId
}

---

# User Hierarchy

The ERP supports three user levels.

## Super Admin

Responsibilities

- Create Companies
- Suspend Companies
- View All Companies
- Manage Licenses
- Manage Platform Settings
- Create Company Admins
- Access every company's data

Super Admin is the only role allowed to cross tenant boundaries.

---

## Company Admin

Each company can have multiple Company Admins.

Responsibilities

- Manage company users
- Assign roles
- Configure company
- Manage all company data

Company Admin can never access another company.

---

## Company Users

Examples

- Accountant
- Sales
- Purchase
- Inventory
- Cashier
- Auditor

Permissions are determined through RBAC.

---

# User Assignment

Users are mapped to companies through

CompanyUser

instead of storing companyId directly on User.

User

↓

CompanyUser

↓

Company

This supports

- Multi-company consultants
- Auditors
- Shared users
- Future expansion

---

# Active Company Context

After login

User

↓

Company Selection

↓

Financial Year Selection

↓

Branch Selection

↓

Dashboard

Session stores

- userId
- companyId
- financialYearId
- branchId
- roleId

Every API must use this context.

---

# Company Initialization

Creating a company is an atomic transaction.

Company creation automatically initializes

- Company
- Company Admin
- Default Financial Year
- Company Settings
- Default Ledger Groups
- Default Voucher Types
- Default Roles
- Default Permissions

If any step fails

Rollback everything.

---

# Authorization

Every API must

1. Authenticate User

2. Resolve Company Context

3. Check Permission

4. Execute Business Logic

5. Write Audit Log

Never execute business logic before authorization.

---

# Repository Rules

Every repository automatically filters by

companyId

unless the module explicitly supports Super Admin.

Super Admin repositories may disable tenant filtering.

All other repositories must enforce it.

---

# Soft Delete Policy

Business masters are never permanently deleted.

Supported

- Active
- Inactive

Historical records must always remain available.

---

# Audit Logging

Every important action creates an Audit Log.

Minimum fields

- companyId
- userId
- module
- action
- recordId
- oldValue
- newValue
- timestamp

---

# Module Boundaries

Only the Company module may manage companies.

Only the User module may manage users.

Only the Role module may manage permissions.

Business modules must never modify authentication or tenant management.

---

# Future Proofing

All future modules must assume

- Multiple companies
- Multiple financial years
- Multiple branches
- Multiple company admins
- Multiple roles
- Multiple warehouses

Never design for a single company.

---

# AI Implementation Rules

When implementing a feature:

1. Read
   - project-overview.md
   - architecture-context.md
   - code-standards.md
   - progress-tracker.md
   - this file

2. Respect existing architecture.

3. Never duplicate logic.

4. Never bypass Repository → Service → UI architecture.

5. Never bypass company isolation.

6. Never trust client-provided tenant identifiers.

7. Every new business table must include companyId unless documented otherwise.

8. Super Admin is the only role that may access multiple companies.

9. If a requested feature conflicts with these decisions, stop and update this document before implementation.
