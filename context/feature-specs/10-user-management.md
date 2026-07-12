# 10 - User Management

## Goal

Implement the **User Management** module for **Premgiri Books ERP**.

This task establishes the User Master — creating, editing, and deactivating the local user accounts that will eventually log in through `07-authentication.md`.

Full login enforcement is deliberately **not** part of this task. `src/lib/current-user.ts` remains the temporary stub described in `progress-tracker.md`'s Architecture Decisions until `07-authentication.md` is built; this task only makes sure real, password-hashed user records exist and can be managed so authentication has something real to check against once it lands.

Do **not** implement Login, Sessions, Branch assignment, or granular Permission management in this task.

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
- `07-authentication.md` (Password Security and Default Roles sections apply directly here)

Follow all documented architecture and coding standards.

---

# Module Responsibilities

The User Management module is responsible for

- User Master
- User Profile
- Password Assignment (hashing only, not login)
- User Activation / Deactivation
- Role Assignment (existing `Role` records only)

The User Management module is **not** responsible for

- Login
- Session Management
- Branch Assignment
- Permission Definitions
- Custom Role Creation

Role Assignment here means picking one of the existing `Role` rows for a user — it does not mean defining what a role can do. Defining permissions belongs to `11-role-permissions.md`.

---

# Features

Implement

- Create User
- Edit User
- View User
- Activate User
- Deactivate User
- Search Users

Do not implement delete.

Users must never be permanently deleted — deactivate instead, consistent with the Company module's "never permanently deleted" rule.

---

# User Information

Extend the existing `User` model from Database Foundation (`username`, `fullName`, `email`, `mobile`, `isActive`, `companyId`, `roleId`). Do not introduce a duplicate table.

Add the one field this task genuinely requires

- `passwordHash` (`String`, required) — never store plain-text passwords.

Support in the UI

- Username
- Full Name
- Email
- Mobile (optional)
- Password (write-only — set on create, optionally reset on edit)
- Role (select from existing `Role` records)
- Status (Active / Inactive)

---

# Default Roles

`07-authentication.md` specifies six default roles: Administrator, Accountant, Sales, Purchase, Store Manager, Employee.

Seed these six rows into the `Role` table if they do not already exist (no `Role` seed data exists yet per Database Foundation). Do not build custom role creation here — that is explicitly deferred to `11-role-permissions.md`, matching `07-authentication.md`'s own "Do not implement custom roles yet."

---

# Password Security

Passwords must never be stored in plain text.

Requirements

- Hash passwords using Argon2 on create and on reset.
- Never return `passwordHash` from any service or action.
- Never log passwords or password hashes.
- Install `argon2` if not already a project dependency.

This mirrors `07-authentication.md`'s Password Security section exactly, so the same hashing convention is reused (not reinvented) when login is eventually built.

---

# Business Rules

- A user belongs to exactly one Company (`companyId`, already enforced by the schema) and exactly one Role (`roleId`, already enforced by the schema).
- `username` and `email` must be unique across the system (already enforced by the schema).
- Only Administrator users may Create, Edit, Activate, or Deactivate users.
- An Administrator cannot deactivate their own account.
- An Administrator cannot deactivate the last remaining active Administrator for a company — at least one active Administrator must always exist.
- Inactive users are excluded from any future login (once `07-authentication.md` lands) but their historical records remain visible.

---

# User Service

Create

```text
src/modules/users/services/user-service.ts
```

Responsibilities

- Create User (hash password, assign role, assign company)
- Update User (optional password reset)
- Get User
- List Users (scoped to a company, searchable)
- Activate User
- Deactivate User (with the last-Administrator safety check)

Business logic belongs here, following the Repository → Service → UI layering already established in the Company and Financial Year modules.

---

# Validation

Use

Zod

Validate

- Username (required, min length)
- Full Name (required)
- Email (required, valid format)
- Mobile (optional, format-checked when present)
- Password (required on create, min length/complexity; optional on edit)
- Role (required, must reference an existing Role)

Provide meaningful validation messages.

---

# UI

Create

```text
src/app/settings/users
```

Pages

- User List (scoped to the active company, search by name/username/email/role)
- Create User
- Edit User

Create reusable components

```text
src/modules/users/components/
```

Examples

- User Form
- User Table
- Role Select

---

# Navigation

Add User Management under

```text
Settings
```

not `Masters`. `architecture-context.md`'s Module Boundaries places "User Management" under the Authentication module boundary, distinct from Masters (Customers, Suppliers, Products). Wire the `Settings` sidebar item to a real route the same way `Masters` was wired to `/company` in `08-company-management.md`.

Visible only to users with Administrator role.

---

# Security

Only Administrator users may

- Create User
- Edit User
- Activate User
- Deactivate User

Other users may only view their own profile (once login exists) — this task builds the Administrator-facing management screens; a self-service "my profile" screen is out of scope.

---

# Database

Use the existing

User

Role

models. Add `passwordHash` to `User`. Do not introduce duplicate tables.

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

- Login
- Session Management
- Branch Assignment
- Custom Role Creation
- Granular Permissions
- Customers
- Suppliers
- Products
- Sales
- Purchase
- Accounting
- GST
- Reports
- Self-service profile editing

Those belong to future implementation tasks.

---

# Success Criteria

Verify

- Users can be created with a hashed password and an assigned role.
- Passwords are hashed with Argon2 and never exposed by any service or action.
- Users can be updated, including an optional password reset.
- Users can be activated and deactivated.
- The last active Administrator for a company cannot be deactivated.
- An Administrator cannot deactivate their own account.
- The six default roles are seeded and selectable.
- User search works by name/username/email/role.
- No TypeScript errors.
- No ESLint errors.

After completion, the project should be ready for **11-role-permissions.md**.
