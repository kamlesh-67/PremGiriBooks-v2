# 11 - Role & Permission Management

## Goal

Implement **Role & Permission Management** for **Premgiri Books ERP**.

`07-authentication.md` introduced six default roles with no permission model ("Do not create permissions yet"). `10-user-management.md` lets users be assigned to those roles, but nothing yet defines what a role can actually do. This task builds that: custom roles, and a granular, per-module permission model that every future business module's API layer must check before executing an action (`ai-workflow-rules.md`'s API Workflow step 3, "Check Permissions").

Per `context/Phases/phases.md`, this is Core ERP Platform infrastructure — shared plumbing every later business module depends on — not a business module itself.

Do **not** implement the business modules (Sales, Purchase, Inventory, Accounting, GST, Reports) this permission model will eventually gate.

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
- `07-authentication.md` (Default Roles, Authorization)
- `10-user-management.md` (Role Assignment)

Follow all documented architecture and coding standards.

---

# Module Responsibilities

The Role & Permission module is responsible for

- Role Master (custom roles, beyond the six defaults)
- Permission Definitions
- Permission Assignment (per role, per module, per action)
- A reusable permission-check helper for future modules

The Role & Permission module is **not** responsible for

- User accounts (`10-user-management.md` owns the `User` model)
- Login / Sessions (`07-authentication.md`)
- Enforcing permissions inside any business module that doesn't exist yet

---

# Features

Implement

- Create Role
- Edit Role
- View Role
- Deactivate Role
- Assign Permissions to a Role (matrix UI: module × action)

Do not implement delete for roles already assigned to a user.

A role with active users cannot be removed — deactivate instead.

---

# Data Model

Extend the existing `Role` model (do not duplicate it) and add two new models.

```text
Role
  id, name, isActive   (isActive is new — Administrator/five defaults start active)

Permission
  id
  module      (e.g. "company", "financial-year", "users", "sales", "purchase", ...)
  action      (e.g. "view", "create", "edit", "delete", "approve", "export")

RolePermission
  id
  roleId      -> Role
  permissionId -> Permission
  @@unique([roleId, permissionId])
```

`module` values should match the sidebar sections already defined in `ui-context.md` (Dashboard, Masters, Sales, Purchase, Inventory, Accounting, GST, Reports, Employees, Settings) plus the finer-grained modules already built (`company`, `financial-year`, `users`). `action` values should cover at minimum: view, create, edit, delete, approve, export.

Seed a default permission set for each of the six roles from `07-authentication.md`:

- Administrator — every module, every action.
- Accountant, Sales, Purchase, Store Manager, Employee — a reasonable starting subset scoped to their name (e.g. Sales gets `sales`/`reports` view+create, not `accounting`/`gst`). These are forward-declarative seed values; the modules themselves don't exist yet, so there is nothing to verify these against beyond the seed data being sensible and editable.

---

# Business Rules

- A role's `name` must be unique (already enforced by the schema).
- A role with one or more assigned users cannot be deactivated below having at least one active Administrator role in the system — do not let the last Administrator-capable role be removed.
- Only Administrator users may Create, Edit, Deactivate roles or reassign permissions.
- Permission checks default to **deny** — a role with no matching `RolePermission` row for a `(module, action)` pair has no access to it.

---

# Permission Check Helper

Create

```text
src/lib/permissions.ts
```

Responsibilities

- `hasPermission(user, module, action): Promise<boolean>`
- `assertPermission(user, module, action): Promise<void>` (throws `AuthorizationError` on failure, mirroring `assertAdministrator()`)

This sits alongside, not instead of, `src/lib/current-user.ts`'s existing `assertAdministrator()`. Do not retrofit `assertAdministrator()` call sites in the Company, Financial Year, or User modules during this task — that is an unnecessary rewrite of working, tested code (`code-standards.md`: "Fix root causes instead of applying temporary workarounds" cuts the other way here — there is no bug to fix, only a new capability to add). Every module built **after** this task should call `assertPermission()` instead of hardcoding `assertAdministrator()`.

---

# Role & Permission Service

Create

```text
src/modules/roles/services/role-service.ts
src/modules/roles/services/permission-service.ts
```

Responsibilities

- Create/Update/List/Deactivate Role
- List Permissions (grouped by module)
- Get/Set a Role's assigned permissions
- Seed default permissions for the six built-in roles (idempotent — safe to run more than once)

Business logic belongs here, following the Repository → Service → UI layering already established in the Company, Financial Year, and User modules.

---

# Validation

Use

Zod

Validate

- Role name (required, min length)
- Permission assignment payload (array of valid `(module, action)` pairs)

Provide meaningful validation messages.

---

# UI

Create

```text
src/app/settings/roles
```

Pages

- Role List
- Create Role
- Edit Role (includes the permission matrix)

Create reusable components

```text
src/modules/roles/components/
```

Examples

- Role Form
- Permission Matrix (module × action checkboxes)
- Role Table

---

# Navigation

Add Role & Permission Management under

```text
Settings
```

alongside User Management (`10-user-management.md`), not `Masters` — same rationale: this is Authentication/security infrastructure, not master data.

Visible only to users with Administrator role.

---

# Security

Only Administrator users may

- Create, Edit, Deactivate roles
- Assign permissions

`hasPermission`/`assertPermission` must default to deny on any missing data (unknown module, unknown action, role with no rows) rather than silently allowing access.

---

# Database

Extend the existing

Role

model with `isActive`. Add new

Permission

RolePermission

models. Do not introduce duplicate role/user tables.

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

- Sales
- Purchase
- Inventory
- Accounting
- GST
- Reports
- Retrofitting existing Administrator-only checks in Company/Financial Year/User modules
- Field-level or row-level permission granularity (module+action only)
- Permission inheritance/hierarchy between roles

Those belong to future implementation tasks.

---

# Success Criteria

Verify

- Custom roles can be created, edited, and deactivated.
- A role with active users cannot be deactivated.
- The last Administrator-capable role cannot be removed.
- Permissions can be assigned per role via the module × action matrix.
- The six default roles have sensible seeded permissions.
- `hasPermission`/`assertPermission` default to deny on missing data.
- No TypeScript errors.
- No ESLint errors.

After completion, the Phase 01 (Foundation) scope from `context/Phases/phases.md` is complete. The next feature-spec (numbered 12 onward) should be scoped from `context/Phases/phases.md`'s Phase 02 — Core ERP Platform when that work is explicitly started, not drafted speculatively ahead of time.
