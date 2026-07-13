# 07 - Authentication & Authorization

## Goal

Implement the complete authentication and authorization system for **Premgiri Books ERP**.

The application is an **Offline-First Desktop ERP**.

Authentication must work completely without internet connectivity.

This task establishes the user login system, session management, and Role-Based Access Control (RBAC).

Do **not** implement business modules.

---

# Project Context

Before implementation, review

- PRD.md
- architecture-context.md
- business-rules.md
- code-standards.md
- ai-workflow-rules.md

Follow all documented architecture and coding standards.

---

# Authentication Strategy

The application uses **Local Authentication**.

There are no third-party providers.

Do not implement

- Google Login
- Microsoft Login
- GitHub Login
- Clerk
- Auth.js
- Better Auth
- Firebase Authentication

Authentication is performed against the local database.

---

# User Authentication

Implement

- Login
- Logout
- Session Validation
- Session Expiration
- Remember Me

The system must support only active users.

Inactive users cannot log in.

---

# Password Security

Passwords must never be stored in plain text.

Requirements

- Hash passwords using Argon2.
- Verify passwords using Argon2.
- Never expose password hashes.
- Never log passwords.

Install

- argon2

---

# Session Management

Implement secure local sessions.

Requirements

- HTTP Only Cookies
- Secure Cookies (Production)
- SameSite protection
- Session expiration
- Session renewal

Store only

- User ID
- Company ID (after company selection)
- Branch ID (optional)
- Financial Year ID (optional)

Do not store sensitive user information inside the session.

---

# Login Screen

Create

```text
src/app/login/page.tsx
```

Requirements

Fields

- Username
- Password

Options

- Remember Me

Buttons

- Login

Footer

- Application Version
- Copyright

No registration screen.

No forgot password.

No social login.

---

# Logout

Implement

- Clear Session
- Redirect to Login

Do not leave any cached authentication state.

---

# Route Protection

Protect all ERP routes.

Unauthenticated users

↓

Redirect

```text
/login
```

Public Routes

- Login

Everything else requires authentication.

> **Amended 2026-07-13** per `architecture-Migration-Super-Admin-Administration.md`:
> `src/proxy.ts` additionally branches authenticated requests by
> `userType`. A `PLATFORM` user (Super Admin) is redirected to
> `/administration` from every route except `/administration/**` and
> `/profile`; a `COMPANY` user is redirected to `/` from anywhere under
> `/administration`. `PLATFORM` users never enter Company Selection/
> Financial Year Selection at all — `getCurrentCompany()`/
> `getCurrentFinancialYear()` short-circuit to `null` for them before any
> cookie read.

---

# Authorization

Implement Role-Based Access Control (RBAC).

Use the existing

Role

table created during Database Foundation.

Do not create permissions yet.

Roles determine access to application modules.

---

# Default Roles

Support

- Administrator
- Accountant
- Sales
- Purchase
- Store Manager
- Employee

Do not implement custom roles yet.

> **Amended 2026-07-13**: "Administrator" is renamed "Company Admin" and is
> no longer the identity check for platform-level authority — Super Admin
> is `User.userType === "PLATFORM"`, not a Role at all
> (`architecture-Migration-Super-Admin-Administration.md`). Every one of
> these 6 roles is now seeded per-company by `TenantBootstrapService`, not
> once globally. Custom roles were later implemented (`11-role-permissions.md`)
> and are also company-scoped.

---

# Session Provider

Create

```text
src/components/providers/auth-provider.tsx
```

Responsibilities

- Session validation
- Current user
- Login state
- Logout

Business modules should consume authentication through this provider.

---

# Authentication Service

Create

```text
src/lib/auth.ts
```

Responsibilities

- Authenticate User
- Verify Password
- Create Session
- Destroy Session
- Validate Session

Keep business logic out of UI components.

---

# Current User Helper

Create

```text
src/lib/current-user.ts
```

Responsibilities

- Get current user
- Get current role
- Get current company
- Get current branch
- Get current financial year

Future modules should reuse this helper.

> **Amended 2026-07-13**: `getCurrentUser()` returns a discriminated union
> (`PlatformCurrentUser | CompanyCurrentUser`) — a `PLATFORM` user has no
> role/company. New `getCurrentCompanyUser()` narrows to the Company
> variant and is what every company-scoped module actually calls.
> `assertAdministrator()`/`isCurrentUserAdmin()` were removed in favor of
> `assertSuperAdmin()`/`isCurrentUserSuperAdmin()` (`userType === "PLATFORM"`,
> the only hardcoded identity check left anywhere in the app) and real
> permission checks for every Company-side capability.

---

# Login Validation

Use

Zod

Validate

- Username
- Password

Display user-friendly validation messages.

---

# Error Handling

Support

- Invalid Username
- Invalid Password
- User Disabled
- Session Expired

Never expose internal errors.

---

# UI Requirements

Follow

ui-context.md

Requirements

- Minimal login screen
- Dark theme by default
- Keyboard-first
- Enter submits form
- Autofocus username
- Password masking
- Loading state during login

---

# Security

Required

- Argon2 Password Hashing
- HTTP Only Cookies
- Secure Sessions
- CSRF Protection where applicable
- No password logging
- No sensitive data in browser storage

Never use

- localStorage for authentication
- sessionStorage for authentication

---

# Folder Structure

Create

```text
src/

app/
    login/

components/
    auth/
    providers/

lib/
    auth.ts
    current-user.ts

middleware.ts
```

Keep authentication isolated from business modules.

---

# Logging

Log

- Successful Login
- Failed Login
- Logout
- Session Expiration

Do not log

- Passwords
- Password Hashes
- Session Tokens

---

# Code Standards

Follow

- architecture-context.md
- code-standards.md

Requirements

- Strict TypeScript
- No `any`
- Reusable services
- No business logic in UI

---

# Do Not

Do not implement

- Company Selection
- Branch Selection
- Financial Year Selection
- User Management
- Permission Management
- Password Reset
- Registration
- Multi-Factor Authentication
- LDAP
- OAuth
- SSO

Those features belong to future implementation tasks.

---

# Success Criteria

Verify

- Login works using local users.
- Passwords are hashed with Argon2.
- Sessions are created securely.
- Logout clears the session.
- Protected routes require authentication.
- Login screen follows the design system.
- Authentication provider works correctly.
- No TypeScript errors.
- No ESLint errors.

After completion, the project should be ready for **08-company-management.md**.
