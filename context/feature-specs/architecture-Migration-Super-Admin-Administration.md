# Architecture Migration - Super Admin & Company Administration

## Goal

Refactor the authentication, authorization, company management, user management, and role & permission architecture to introduce a clear separation between **Platform Administration** and **Company Administration**.

This is an **architecture migration**, not a feature addition.

The goal is to establish a scalable SaaS/ERP architecture before additional business modules are implemented.

This migration supersedes the previous "Administrator" architecture.

---

# Background

The current implementation assumes a single **Administrator** role that manages both platform-level and company-level responsibilities.

This architecture is no longer sufficient for a multi-company ERP because it mixes two completely different responsibilities.

Platform management and company management must be separated.

---

# New User Hierarchy

The ERP now supports three levels of users.

```text
Super Admin (Platform)

        ↓

Company Admin

        ↓

Company Users
    ├── Accountant
    ├── Sales
    ├── Purchase
    ├── Inventory
    ├── Store Manager
    └── Employee
```

---

# Super Admin

Super Admin is the owner of the ERP platform.

A Super Admin is **not associated with any company**.

Super Admin can

- Create Company
- Edit Company
- Activate Company
- Deactivate Company
- View all companies
- Create Company Admin
- Reset Company Admin password
- Assign Company Admins
- Manage platform settings
- Manage licenses
- Manage subscriptions
- Manage system configuration
- Access every company's data
- View all audit logs
- Perform backup and restore

Super Admin bypasses tenant isolation.

---

# Company Admin

Every company has one or more Company Admins.

Company Admin is responsible only for company-specific operations.

Company Admin can

- Manage company users
- Create users
- Edit users
- Deactivate users
- Reset passwords
- Manage roles
- Assign permissions
- Manage branches
- Manage financial years
- Manage ledgers
- Manage accounting masters
- Manage inventory masters
- Configure company settings
- View reports

Company Admin cannot

- Create companies
- Update company master information
- Suspend companies
- View another company's data
- Access platform settings
- Manage Super Admin accounts

---

# Company Users

Company Users perform daily business operations.

Examples

- Accountant
- Sales
- Purchase
- Inventory
- Store Manager
- Employee

Permissions are controlled through Role-Based Access Control.

---

# Database Changes

Replace the previous Administrator architecture.

Introduce

```text
enum UserType

PLATFORM
COMPANY
```

User

```text
userType

PLATFORM
COMPANY
```

A PLATFORM user never belongs to a company.

A COMPANY user always belongs to one company.

Do not create duplicate user tables.

---

# Default Roles

Replace

```text
Administrator
Accountant
Sales
Purchase
Store Manager
Employee
```

with

```text
Company Admin
Accountant
Sales
Purchase
Store Manager
Employee
```

Super Admin is **not** a Role.

Super Admin is determined by

```text
UserType = PLATFORM
```

This prevents platform users from accidentally being assigned company roles.

---

# Authentication Flow

When a user logs in

Authenticate User

↓

Check User Type

If PLATFORM

↓

Open Platform Dashboard

If COMPANY

↓

Company Selection

↓

Financial Year Selection

↓

Branch Selection

↓

ERP Dashboard

---

# Session

Platform User Session

```text
userId
userType
```

Company User Session

```text
userId
userType
companyId
financialYearId
branchId
```

Never store unnecessary information.

---

# Platform Module

Create a new module

```text
Platform
```

Responsibilities

- Companies
- Company Admins
- Licenses
- Platform Settings
- Audit
- System Configuration
- Backup
- Restore

Only Super Admin can access this module.

Company users must never see it.

---

# Company Module

The Company module is no longer responsible for creating companies.

Company Management now has two responsibilities.

## Platform

Create Company

Edit Company

Deactivate Company

Assign Company Admin

## Company

View Company

Company Settings

Logo

Preferences

Theme

Currency Display

Date Format

Time Format

Company Admin may only modify operational settings.

Legal business information is managed only by Super Admin.

---

# Company Creation

Company creation becomes a platform operation.

Workflow

```text
Super Admin

↓

Create Company

↓

Create Company Admin

↓

Initialize Company

↓

Create Company Settings

↓

Create Financial Year

↓

Seed Default Roles

↓

Seed Permissions

↓

Seed Ledger Groups

↓

Seed Default Ledgers

↓

Finished
```

Everything executes inside one transaction.

Failure rolls back the entire company.

---

# User Management

Company Admin manages only users within their own company.

Company Admin can

- Create users
- Edit users
- Reset passwords
- Assign roles
- Activate users
- Deactivate users

Company Admin cannot

- Create Super Admin
- Modify Super Admin
- Access another company

Super Admin can manage every user.

---

# Role & Permission Management

Role Management becomes company scoped.

Company Admin

- Create Roles
- Edit Roles
- Assign Permissions

Super Admin

- Full Access

Company Admin cannot remove the final active Company Admin role.

---

# Permission Architecture

Separate platform permissions from company permissions.

Platform permissions

```text
platform.company.create
platform.company.update
platform.company.activate
platform.company.deactivate
platform.company.assignAdmin

platform.user.manage

platform.settings.manage

platform.audit.view
```

Company permissions

```text
company.users.*

company.roles.*

company.settings.*

accounting.*

inventory.*

sales.*

purchase.*

reports.*
```

Never mix platform permissions with company permissions.

---

# Tenant Isolation

Tenant isolation applies only to Company Users.

Every repository must automatically filter using

```text
currentCompanyId
```

Super Admin repositories may explicitly bypass tenant filtering.

No other module may bypass tenant isolation.

---

# Navigation

## Super Admin

Platform

- Dashboard
- Companies
- Company Admins
- Licenses
- Audit
- Settings

## Company Users

ERP

- Dashboard
- Masters
- Accounting
- Inventory
- Sales
- Purchase
- Reports
- Settings

The Platform menu must never appear for Company Users.

---

# Required Changes

Rewrite the following specifications.

- 06-database-foundation.md
- 07-authentication.md
- 08-company-management.md
- 10-user-management.md
- 11-role-permissions.md

Remove every assumption that "Administrator" owns both platform and company responsibilities.

Replace it with

Platform

↓

Super Admin

Company

↓

Company Admin

↓

Company Users

---

# Compatibility Rules

Existing business modules

- Ledger Groups
- Ledger Master
- Bank Management
- Expense Heads
- Income Heads

must continue to function without business logic changes.

Only authorization and ownership rules should change.

---

# Success Criteria

Verify

- Super Admin can manage every company.
- Company Admin cannot create or edit company master records.
- Company Admin can manage only assigned company users.
- Platform users never require company context.
- Company users always require company context.
- Platform permissions are separated from company permissions.
- Company isolation remains enforced.
- Repository → Service → UI architecture remains unchanged.
- Existing accounting modules continue to function.
- No TypeScript errors.
- No Prisma validation errors.
- No ESLint errors.

---

# Expected Result

The ERP now follows a proper enterprise multi-tenant architecture where:

- Super Admin owns the ERP platform.
- Company Admin owns company operations.
- Company Users perform business activities.
- Company master data is controlled only by the platform.
- Every future module automatically inherits the correct authorization model.
