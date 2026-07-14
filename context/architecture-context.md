# Architecture Context

## Architecture Style

Premgiri Books ERP follows an **Offline-First Modular Monolith Architecture**.

The application is designed to run completely on a local computer or local office network without requiring an internet connection.

All business operations including Accounting, GST, Inventory, Billing, Purchasing, Reports, and Printing are executed locally.

Cloud connectivity is optional and reserved for future capabilities such as cloud backup, GST portal integration, mobile applications, and synchronization.

The system is divided into independent business modules that share common business engines instead of duplicating business logic.

---

# Technology Stack

| Layer           | Technology                              | Purpose                            |
| --------------- | --------------------------------------- | ---------------------------------- |
| Desktop Runtime | Electron                                | Cross-platform desktop application |
| Frontend        | Next.js 16 + React + TypeScript         | User Interface                     |
| UI Library      | Tailwind CSS + shadcn/ui                | Modern UI Components               |
| Backend         | Next.js Server Actions + Route Handlers | Local Business APIs                |
| Database        | PostgreSQL (Local)                      | Primary Database                   |
| ORM             | Prisma                                  | Database Access Layer              |
| Authentication  | Local Authentication                    | User Login & Security              |
| File Storage    | Local File System                       | PDFs, Images, Backups              |
| Reporting       | PDF & Excel Export                      | Business Reports                   |
| Validation      | Zod                                     | Input Validation                   |
| Logging         | Pino                                    | Application Logging                |

---

# Layered Architecture

```
┌────────────────────────────────────┐
│          Desktop (Electron)         │
└────────────────────────────────────┘
                 │
                 ▼
┌────────────────────────────────────┐
│      Presentation Layer (UI)        │
│ Dashboard                           │
│ Sales                               │
│ Purchase                            │
│ Inventory                           │
│ Accounting                          │
│ GST                                 │
│ Reports                             │
│ Settings                            │
└────────────────────────────────────┘
                 │
                 ▼
┌────────────────────────────────────┐
│        Business Layer               │
│ Voucher Engine                      │
│ Pricing Engine                      │
│ Inventory Engine                    │
│ GST Engine                          │
│ Reporting Engine                    │
└────────────────────────────────────┘
                 │
                 ▼
┌────────────────────────────────────┐
│          Data Layer                 │
│ Prisma ORM                          │
│ PostgreSQL                          │
│ Local File Storage                  │
└────────────────────────────────────┘
                 │
                 ▼
┌────────────────────────────────────┐
│     Future Cloud Services           │
│ Cloud Backup                        │
│ GST APIs                            │
│ Mobile App                          │
│ AI Services                         │
│ Sync                                │
└────────────────────────────────────┘
```

---

# Core Business Principles

## Voucher Driven

Every financial transaction must generate accounting vouchers.

Examples

- Sales Invoice
- Purchase Invoice
- Receipt Voucher
- Payment Voucher
- Contra Voucher
- Journal Voucher
- Sales Return
- Purchase Return

Financial reports must always be generated from voucher entries.

---

## Document Driven

Every transaction is treated as a business document.

Lifecycle

```
Draft
    ↓
Saved
    ↓
Approved
    ↓
Posted
    ↓
Voucher Generated
    ↓
Locked
    ↓
Cancelled (Optional)
```

---

## Engine Driven

Business rules must exist only inside business engines.

User Interface components must never calculate:

- GST
- Selling Price
- Margin
- Ledger Entries
- Inventory Movement

Screens only request services from the engines.

---

# Core Engines

## Voucher Engine

Responsibilities

- Double Entry Accounting
- Voucher Posting
- Journal Entries
- Ledger Posting
- Trial Balance
- Profit & Loss
- Balance Sheet
- Cash Book
- Bank Book
- Audit Trail

---

## Pricing Engine

Responsibilities

- Latest Purchase Cost
- Margin Profiles
- Price Lists
- Customer Pricing
- Dealer Pricing
- Wholesale Pricing
- Discount Rules
- Selling Price Calculation

---

## Inventory Engine

Responsibilities

- Stock In
- Stock Out
- Warehouse Management
- Stock Transfer
- Stock Adjustment
- Physical Verification
- Stock Ledger
- Stock Valuation

---

## GST Engine

Responsibilities

- GST Calculation
- CGST
- SGST
- IGST
- CESS
- HSN Summary
- GST Registers
- GSTR-1
- GSTR-3B

---

## Reporting Engine

Responsibilities

- Dashboard
- Financial Reports
- Sales Reports
- Purchase Reports
- Inventory Reports
- GST Reports
- Excel Export
- PDF Export

---

# Module Boundaries

## Authentication

Responsible for

- Login
- User Management
- Roles
- Permissions
- Session Management

---

## Company

Responsible for

- Company Details
- Branches
- Financial Years
- Banks
- Company Settings

---

## Masters

Responsible for

- Customers
- Suppliers
- Products
- Categories
- Brands
- Units
- Warehouses
- Employees
- HSN Codes
- GST Rates
- Price Lists
- Margin Profiles

Masters never generate accounting entries.

---

## Sales

Responsible for

- Quotations
- Sales Orders
- Delivery Challans
- Sales Invoices
- Sales Returns

Sales module communicates only through

- Pricing Engine
- Inventory Engine
- Voucher Engine
- GST Engine

---

## Purchase

Responsible for

- Purchase Orders
- Goods Receipt
- Purchase Invoices
- Purchase Returns

Purchase communicates only through shared business engines.

---

## Inventory

Responsible for

- Opening Stock
- Stock Adjustment
- Stock Transfer
- Warehouse Operations
- Physical Verification

Inventory module never creates accounting entries directly.

---

## Accounting

Responsible for

- Receipt Voucher
- Payment Voucher
- Contra Voucher
- Journal Voucher
- Ledger Inquiry

Accounting uses Voucher Engine.

---

## GST

Responsible for

- GST Reports
- GST Registers
- Return Generation

GST module never updates accounting directly.

---

## Employee

Responsible for

- Employee Master
- Attendance
- Salary
- Payroll

---

## Reports

Responsible only for presenting information.

Reports never modify business data.

---

# Data Storage

## PostgreSQL Database

Stores

- Companies
- Users
- Roles
- Customers
- Suppliers
- Products
- Inventory
- Vouchers
- Voucher Entries
- Ledgers
- GST Data
- Employees
- Business Settings

---

## Local File Storage

Stores

- Invoice PDFs
- Company Logos
- Product Images
- Excel Imports
- Excel Exports
- Backup Files
- Attachments

Database stores only file references.

---

# Offline Strategy

Premgiri Books ERP is designed to function completely offline.

No internet connection is required for

- Login
- Sales
- Purchase
- Inventory
- Accounting
- GST Calculation
- Reports
- Invoice Printing
- Barcode Printing
- Customer Management
- Supplier Management
- Backup

Internet is required only for future services.

---

# Security Model

- Local User Authentication
- Role-Based Access Control (RBAC)
- Company-Level Isolation
- Branch-Level Permissions
- Audit Logs
- Soft Delete
- Daily Automatic Backup
- Future Database Encryption

---

# Multi-Tenant & Governance Architecture

This section merges the permanent decisions from
`context/feature-specs/ai-architecture-decisions.md` (v1.0) into this
document, per that file's own precedence rule ("if any feature specification
conflicts with this document, this document takes precedence" — refers to
`ai-architecture-decisions.md` itself). Where the current implementation
does not yet match a decision below, it is called out explicitly in
**Known Implementation Gaps** rather than silently assumed compliant.

## Tenant Isolation Rule

Every database query for a business entity must scope data using the
authenticated session's company context, never a client-supplied value.

Correct

```
where: { companyId: currentCompany.id }
```

Never

```
where: { companyId: request.companyId }
```

Every repository in this codebase that reads or writes a specific business
record already re-verifies `companyId` matches the requesting user's own
company (treating a cross-company id as "not found," never leaking
existence) — established by `user-repository.ts`/`user-service.ts` and
followed by every module since (`ledger-groups`, `ledgers`,
`bank-accounts`).

## User Hierarchy

Three conceptual levels, now fully implemented (not just documented) per
`context/feature-specs/architecture-Migration-Super-Admin-Administration.md`
and its
`architecture-Migration-Super-Admin-Administration-Implementation-Plan.md`,
completed 2026-07-13:

- **Super Admin** — `User.userType === "PLATFORM"`, has no `companyId`/
  `roleId`. Not a Role (Permanent Architecture Principle 9) — determined
  purely by `userType`. Creates/activates/deactivates companies, creates
  the first Company Admin, resets Company Admin passwords, sees every
  company. Gated by the single hardcoded check `assertSuperAdmin()`
  (`src/lib/current-user.ts`) — the *only* hardcoded identity check left
  in the app.
- **Company Admin** — `User.userType === "COMPANY"`, holding that
  company's `isSystemDefined`/`isProtected` "Company Admin" role (granted
  every catalog permission). Manages users, roles, and all data within one
  company; can never access another company or reach `/administration`.
  Gated the same way every other Company-side capability is: real
  `assertPermission()` checks, never a role-name compare (Principle 1/2).
- **Company Users** — Accountant, Sales, Purchase, Store Manager, Employee,
  or custom roles, permissioned through RBAC, scoped to one company.

## User Assignment — Target Model vs. Current Implementation

`ai-architecture-decisions.md` specifies users are mapped to companies
through a `CompanyUser` join table (`User → CompanyUser → Company`) rather
than a direct `companyId` on `User`, to support multi-company consultants,
auditors, and shared users.

**Current implementation still diverges from this**: `User.companyId` is a
direct field (now nullable, to support `PLATFORM` users with no company at
all — see Known Implementation Gaps item 1, still deferred). `Role` **is**
now scoped per company (`Role.companyId`, required) — every company has its
own private clone of the 6 reserved default roles, seeded by
`TenantBootstrapService` at company-creation time; `Permission` remains a
global capability-definition catalog (module x action pairs), which is
correct — it's not tenant data, only `Role`/`RolePermission` needed
scoping.

## Active Company Context

```
User → Company Selection → Financial Year Selection → Branch Selection → Dashboard
```

Unchanged for `COMPANY` users. A `PLATFORM` user never enters this flow at
all — `getCurrentCompany()`/`getCurrentFinancialYear()` short-circuit to
`null` for them before any cookie read or DB query (Permanent Architecture
Principle 5), and `src/proxy.ts` redirects them straight to
`/administration` on every route outside that tree (and `/profile`, shared
by both user types). Session stores `userId`/`userType`; `companyId`/
`financialYearId`/`branchId` remain cookie-based, not session-embedded (an
earlier, independent 2026-07-13 decision — recorded in
`context/progress-tracker.md` — not reversed by this migration).

## Company Initialization

Creating a company is an atomic transaction. Per
`ai-architecture-decisions.md`, creation should initialize: Company,
Company Admin, Default Financial Year, Company Settings, Default Ledger
Groups, Default Voucher Types, Default Roles, Default Permissions — with a
full rollback if any step fails.

**Current implementation now matches this closely**:
`companyService.createCompany()` (Super-Admin-only,
`src/modules/company/services/company-service.ts`) creates the `Company`
row, then `tenantBootstrapService.bootstrapTenant()`
(`src/modules/administration/services/tenant-bootstrap-service.ts`) — the
single owner of company initialization (Principle 4) — seeds that
company's 6 roles + their permissions, the Financial Year, the 23-group
Ledger Group skeleton, and the default "Cash" Ledger, then the Company
Admin `User` row is created, all inside one `prisma.$transaction`. Default
Voucher Types still do not exist (the Voucher Engine is not implemented).

## Authorization Flow

Every mutation must follow:

```
Authenticate → Resolve User Type
  → PLATFORM: assertSuperAdmin() → Execute
  → COMPANY: Resolve Company Context → Check Permission → Execute → Write Audit Log
```

`assertPermission(user, module, action)` after `getCurrentCompanyUser()` is
enforced end-to-end for every Company-side mutation, including the ones
that used to hardcode a role-name check (Company/Company Settings,
Financial Year, Users, Roles/Permissions) — see Known Implementation Gaps
item 3 for the scope of `AuditLog` writes (narrow, not universal).

## Repository Rules

Every repository automatically filters by `companyId`, and none perform
authorization themselves (Permanent Architecture Principle 3 — that
branching lives in Services only; repositories never check
`userType`/`PLATFORM`/`COMPANY`). The two Platform-only cross-company
exceptions (`userRepository.findAllCompanyAdmins()`/`setActiveById()`, for
the Administration module's Company Admins screen) are gated by
`assertSuperAdmin()` one layer up, in `platform-user-service.ts`, never in
the repository.

## Known Implementation Gaps vs. `ai-architecture-decisions.md`

Recorded per this project's precedence rule (record a documentation/code
conflict before changing code) rather than fixed unilaterally, since each
is a cross-cutting change spanning authentication, every existing module,
or both — out of scope for a single-module fix and requiring its own
scoped feature spec:

1. **User↔Company mapping**: still direct `User.companyId` (now nullable,
   for `PLATFORM` users), not a `CompanyUser` join table. Migrating to a
   real join table (for multi-company consultants/auditors/shared users)
   touches auth, sessions, and every module that reads `user.companyId` —
   remains its own scoped effort, not attempted by the Super Admin
   migration.
2. ~~Role/Permission are global, not per-company~~ — **resolved
   2026-07-13**. `Role.companyId` is now required; every company has its
   own private clone of the 6 reserved default roles, seeded by
   `TenantBootstrapService`. `Permission` correctly remains global (a
   capability-definition catalog, not tenant data).
3. **Audit Logging remains narrow, not universal.** A new `AuditLog` model
   exists (2026-07-13) but its write path covers only the 5 Administration-
   side tenant-lifecycle events the Super Admin migration introduced
   (Company Created, Company Admin Created, Company
   Activated/Deactivated, Company Admin Password Reset) —
   `auditLogService.record()`,
   `src/modules/administration/services/audit-log-service.ts`. No other
   module (Ledger Groups, Ledger Master, Bank Management, Users, Roles,
   Company Settings) writes an audit trail entry yet; a general retrofit
   remains a separate, larger effort.
4. **`createdBy`/`updatedBy` are not present on any business table** —
   every table has `createdAt`/`updatedAt` but not the actor who made the
   change. `AuditLog.actorUserId` covers this for the 5 events it records;
   every other table still has no way to attribute historical writes.
5. ~~Platform (Super Admin) vs. Company (Company Admin/Company Users) is
   not yet a real distinction anywhere except the schema~~ — **resolved
   2026-07-13**. See the User Hierarchy / Authorization Flow sections
   above and
   `context/feature-specs/architecture-Migration-Super-Admin-Administration-Implementation-Plan.md`
   for the full implementation: `userType`-discriminated `CurrentUser`,
   proxy-level PLATFORM/COMPANY route separation, per-company Roles, the
   `/administration` module, and the rewritten Company Creation workflow.
6. **`SystemContext` (`src/lib/system-context.ts`) is the standard for new
   code, not retrofitted onto the ~15 pre-migration services** that still
   call `getCurrentUser()`/`getCurrentCompanyUser()` directly
   (bank-accounts, ledgers, ledger-groups, financial-year,
   company-settings, users, roles, permissions, profile). Those primitives
   are already per-request `cache()`-deduped, so this is a pure
   consistency/readability cleanup, not a correctness gap — tracked as a
   follow-up, not silently dropped.

These are tracked as open follow-up work in `context/progress-tracker.md`
rather than implemented ad hoc inside an unrelated feature fix.

---

# Costing Strategy

Current Costing Method

- Latest Purchase Cost

Pricing Engine always uses the latest purchase cost for

- Selling Price Calculation
- Margin Calculation
- Inventory Valuation (Current Version)

Future versions may support

- FIFO
- Weighted Average
- Standard Cost

---

# Product Architecture

Supported Product Types

- Trading Product
- Service
- Expense Item

Reserved Product Types

- Formula Product (Future Release)

The Formula Product type is reserved for future manufacturing and automotive paint formulation features.

---

# Customer Architecture

Supported Customer Types

## Permanent Customer

- Customer Master
- Ledger
- Credit Limit
- Outstanding
- Statement

---

## Quick Customer

Created during billing.

Stores

- Name
- Mobile
- Address
- GSTIN
- Email

Can later be converted into a permanent customer.

---

## Walk-in Customer

- Default Cash Customer
- No Master Record
- No Ledger
- Fast Billing

---

# Future Architecture

The following modules are planned for future releases.

## Formula Management & Production

Designed for industries such as

- Automotive Paint Mixing
- Chemical Blending
- Ink Manufacturing
- Adhesives
- Lubricants

Planned Features

- Formula Management
- Recipe Library
- Manufacturer-wise Color Library
- Vehicle-wise Formula Library
- Production Orders
- Batch Manufacturing
- Raw Material Consumption
- Production Costing
- Formula Versioning
- Wastage Tracking
- On-Demand Production
- Finished Goods Management

This module will integrate with

- Pricing Engine
- Inventory Engine
- Voucher Engine
- GST Engine

without requiring architectural changes.

---

# Future Online Services

Planned cloud capabilities

- Cloud Backup
- Multi-System Synchronization
- Mobile Application
- Online Dashboard
- WhatsApp Integration
- GST Portal Integration
- E-Invoice
- E-Way Bill
- AI Assistant
- License Management

---

# Invariants

1. Every financial transaction must generate vouchers.
2. Posted documents cannot be edited.
3. Reports are read-only.
4. Business rules belong only inside business engines.
5. Modules communicate through shared services, never by directly modifying another module's data.
6. Pricing is always calculated by the Pricing Engine.
7. Inventory movements are managed only by the Inventory Engine.
8. GST calculations are managed only by the GST Engine.
9. Accounting reports derive data only from vouchers.
10. All core business operations must work without an internet connection.
11. Cloud services must remain optional and never block local business operations.
12. Future modules must integrate without changing existing module boundaries.

```

```
