# 06 - Database Foundation

## Goal

Design the foundational database structure for **Premgiri Books ERP**.

This task creates the common entities and conventions that every ERP module will use.

Do **not** implement Customers, Products, Inventory, Sales, Purchase, Accounting, or GST.

---

# Project Context

The application uses

- Prisma
- PostgreSQL
- Offline-First Architecture

All future database models must follow the same conventions established in this task.

---

# Create Base Models

Create the following models only.

## Company

Represents a business.

Include fields for

- Company Name
- Legal Name
- GSTIN
- PAN
- Address
- Contact Information
- Email
- Website
- Logo
- Currency
- Time Zone
- Is Active
- Created At
- Updated At

Do not add business settings yet.

---

## Financial Year

Represents an accounting period.

Include

- Company Relation
- Name
- Start Date
- End Date
- Is Current
- Is Closed

One company may have multiple financial years.

Only one financial year may be current.

---

## Branch

Represents a business branch.

Include

- Company Relation
- Branch Name
- Branch Code
- Address
- Contact Number
- GST Registration (optional)
- Is Active

---

## User

Create the internal ERP user model.

Do not integrate authentication yet.

Include

- Username
- Full Name
- Email
- Mobile
- Is Active
- Company Relation

Password implementation will be added later.

---

## Role

Create the role master.

Examples

- Administrator
- Accountant
- Sales
- Purchase
- Store Manager

Do not create permissions yet.

---

# Shared Fields

Every future business model should follow these conventions.

Required

- id
- createdAt
- updatedAt

Optional

- createdBy
- updatedBy
- deletedAt
- remarks

Do not implement these fields on every table yet.

Document the convention for future models.

---

# Naming Standards

Model Names

Singular

Examples

```text
Company
Customer
Product
Voucher
```

Table Names

Default Prisma naming.

Field Names

camelCase

Enum Names

PascalCase

---

# Relationships

Create only the following relationships.

Company

↓

FinancialYear

Company

↓

Branch

Company

↓

User

Role

↓

User

Do not create any other relationships.

---

# Indexing

Add indexes only where appropriate.

Examples

- Company Name
- GSTIN
- Financial Year
- Username
- Email
- Branch Code

Do not over-index.

---

# Constraints

Ensure

- Company GSTIN is unique.
- Branch Code is unique within a company.
- Username is unique.
- Email is unique.
- Only one current financial year exists per company.

Implement only where supported by Prisma.

---

# Migration

Generate the initial migration.

Generate Prisma Client.

Verify migration succeeds.

---

# Seed Data

Do not create seed data.

Do not insert default records.

This will be handled in later tasks.

---

# Folder Structure

Use

```text
prisma/

schema.prisma

migrations/

src/lib/prisma.ts
```

Do not split the schema into multiple files yet.

The schema should remain manageable during the foundation stage.

---

# Code Standards

Follow

- architecture-context.md
- code-standards.md

Requirements

- Strict typing
- Proper relations
- Clean naming
- Minimal schema
- No duplicated fields

---

# Do Not

Do not create

- Customers
- Suppliers
- Products
- Categories
- Inventory
- Sales
- Purchase
- Accounting
- GST
- Employees
- Reports
- Vouchers
- Ledgers

Only create the shared database foundation.

---

# Success Criteria

Verify

- Migration completes successfully.
- Prisma Client is generated.
- Company model exists.
- Financial Year model exists.
- Branch model exists.
- User model exists.
- Role model exists.
- Relationships compile correctly.
- No TypeScript errors.
- No Prisma validation errors.

After completion, the project should be ready for **07-authentication.md**.
