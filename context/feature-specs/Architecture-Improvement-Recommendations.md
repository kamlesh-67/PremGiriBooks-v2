# Architecture Improvement Recommendations

**Project:** Premgiri Books ERP  
**Version:** 1.0  
**Status:** Proposed Improvements  
**Priority Order:** High → Low

---

# Priority 1 (Critical)

These should ideally be completed before starting Accounting (Phase 3).

---

## 1. Document the User Architecture Divergence Consistently

### Priority

🔴 Critical

### Problem

The documentation currently contains two different user architectures.

Current implementation uses:

```
User
 ├── companyId
 ├── roleId
 └── userType
```

But `AI Architecture Decisions` still documents:

```
User
    ↓
CompanyUser
    ↓
Company
```

**Correction (verified against `context/architecture-context.md`, "Known
Implementation Gap #1"):** this is not unresolved confusion — it is already
an explicit, tracked, deliberate decision. `CompanyUser` is the documented
**future target model** (to support multi-company consultants, auditors, and
shared users); `User.companyId` is the documented **current interim
implementation**, kept direct because migrating to a real join table touches
auth, sessions, and every module that reads `user.companyId` — its own
scoped future effort, not something to resolve by picking one and deleting
the other today.

The actual risk is narrower: this divergence is recorded in
`architecture-context.md` but `ai-architecture-decisions.md` still presents
`CompanyUser` as if it were the current model, with no note that it's a
future target. That inconsistency between the two docs — not the
architecture decision itself — is what risks confusing a future AI
implementation.

### Recommendation

Do **not** remove the `CompanyUser` design. Instead, align
`ai-architecture-decisions.md` with `architecture-context.md`'s existing
resolution: mark the `User → CompanyUser → Company` diagram there as the
**future target model**, add a pointer to `architecture-context.md`'s Known
Implementation Gap #1 for the current-vs-target distinction, and confirm
`User.companyId`/`roleId`/`userType` as the authoritative current schema
everywhere else. Revisit an actual migration only if/when true multi-company
users become a real requirement.

---

## 2. Introduce Domain Services

### Priority

🔴 Critical

### Problem

Service classes will become extremely large once accounting modules begin.

Example:

```
VoucherService

Create Voucher

↓

Ledger Posting

↓

Inventory Posting

↓

GST Posting

↓

Bank Posting

↓

Audit

↓

Stock Update
```

Eventually this becomes a 1000+ line service.

### Recommendation

Split business logic.

Example:

```
VoucherApplicationService

↓

VoucherPostingService

↓

LedgerPostingService

↓

InventoryPostingService

↓

GSTService

↓

AuditService
```

---

## 3. Introduce Internal Domain Events

### Priority

🔴 Critical — **Implemented 2026-07-14.** `src/lib/domain-events.ts` (a
minimal in-process, same-transaction event bus) plus a `company.bootstrapped`
event decoupling `tenant-bootstrap-service.ts` from directly importing
`ledgerGroupService`/`ledgerService` — see `context/progress-tracker.md`'s
matching Completed entry for the full account, including why Financial
Year/Role seeding deliberately stayed as direct calls rather than events.

### Problem

Modules currently call each other directly.

Example:

```
Company

↓

TenantBootstrap

↓

Ledger

↓

Roles

↓

FinancialYear
```

This creates tight coupling.

### Recommendation

Introduce lightweight internal events.

Example

```
CompanyCreated

↓

TenantBootstrap

↓

Seed Roles

↓

Seed Ledger Groups

↓

Seed Permissions

↓

Audit
```

No message broker is needed.

Simple in-process events are sufficient.

---

## 4. Shared Transaction Manager

### Priority

🔴 Critical — **Implemented 2026-07-14.** `src/lib/transaction.ts`'s
`runInTransaction()` now backs every `prisma.$transaction` call site in the
codebase; the two duplicated local `withRetry` utilities were deleted. See
`context/progress-tracker.md`'s matching Completed entry.

### Problem

Every module manually writes

```
prisma.$transaction(...)
```

along with

- retries
- isolation level
- audit logging

This duplicates logic.

### Recommendation

Create

```
TransactionService.run()

or

runInTransaction()
```

Every module uses the same transaction helper.

---

# Priority 2 (High)

Should be completed before Ledger/Voucher implementation.

---

## 5. Separate Application Services from Domain Services

### Priority

🟠 High

### Current

```
Repository

↓

Service

↓

UI
```

### Recommended

```
UI

↓

Application Service

↓

Domain Service

↓

Repository
```

Application Service

- authorization
- orchestration
- transactions

Domain Service

- business rules

---

## 6. Standardize Repository Return Types

### Priority

🟠 High

### Current

Repositories inconsistently return

- null
- boolean
- status objects
- exceptions

### Recommendation

Adopt one standard.

Example

```
Result<T>

Success

Failure
```

Avoid mixing multiple patterns.

---

## 7. Extract Business Rule Specifications

### Priority

🟠 High

Instead of

```
if (...)
if (...)
if (...)
```

inside services

create reusable specifications.

Examples

- CanDeactivateUserSpecification
- CanCreateFinancialYearSpecification
- VoucherBalancedSpecification
- LastActiveAdminSpecification
- LedgerEditableSpecification

---

## 8. Add Validation Layer

### Priority

🟠 High

Current

```
Action

↓

Service
```

Recommended

```
Action

↓

DTO

↓

Validator

↓

Application Service
```

Separates parsing, validation, and business logic.

---

## 9. Introduce Error Codes

### Priority

🟠 High

Current

Errors depend on message strings.

Recommended

```
USER_ALREADY_EXISTS

ROLE_PROTECTED

LAST_ACTIVE_ADMIN

COMPANY_INACTIVE

INVALID_FINANCIAL_YEAR
```

Messages become presentation-only.

---

# Priority 3 (Medium)

Useful before advanced modules.

---

## 10. Version Tenant Bootstrap

### Priority

🟡 Medium

Current

```
TenantBootstrapService
```

Recommended

```
BootstrapV1

BootstrapV2

BootstrapV3
```

Supports future upgrades.

---

## 11. Introduce Module Contracts

### Priority

🟡 Medium

Instead of services depending directly on services

Use interfaces.

Examples

```
ILedgerPosting

IGSTCalculator

IBankPosting

IInventoryPosting
```

Allows independent module evolution.

---

## 12. Prepare Background Job Infrastructure

### Priority

🟡 Medium

Future modules require

- Backup
- Email
- GST Export
- Excel Import
- Scheduled Reports

Create

```
JobQueue

↓

JobHandler
```

Even if execution remains synchronous initially.

---

## 13. Define Aggregate Roots

### Priority

🟡 Medium

Document ownership boundaries.

Example

```
Company
 ├── Settings
 ├── Users
 ├── Roles

Financial Year
 ├── Voucher

Voucher
 ├── Ledger Entries

Ledger
 ├── Transactions
```

Prevents business-rule violations.

---

## 14. Define Module Dependency Matrix

### Priority

🟡 Medium

Document allowed dependencies.

| Module  | Depends On        |
| ------- | ----------------- |
| Company | None              |
| Users   | Company           |
| Roles   | Company           |
| Ledger  | Financial Year    |
| Voucher | Ledger            |
| GST     | Voucher           |
| Reports | Read-only modules |

Avoid cyclic dependencies.

---

# Priority 4 (Low)

Quality improvements for long-term maintenance.

---

## 15. Module Registration System

### Priority

🟢 Low

Instead of hardcoding

- routes
- sidebar
- permissions
- initialization

Create module manifests.

Example

```ts
{
  module: "ledger",
  routes: [],
  sidebar: [],
  permissions: [],
  bootstrap: []
}
```

Improves modularity.

---

## 16. Expand Audit Logging Standard

### Priority

🟢 Low

Standardize audit entries.

Include

- Correlation ID
- Request ID
- User ID
- Company ID
- Module
- Action
- Old Value
- New Value
- Timestamp
- Metadata

---

# Documentation Improvements

### Priority

🟢 Low

## 17. Clarify (Not Remove) the `CompanyUser` Architecture

`CompanyUser` in AI Architecture Decisions is not obsolete — per
`architecture-context.md`'s Known Implementation Gap #1, it is the
documented future target model, deliberately deferred. Update AI
Architecture Decisions to label it as such (future target, not current
model) and cross-reference `architecture-context.md`, instead of deleting
it. See the correction under Recommendation 1 above.

---

## 18. Centralize Authorization Documentation

Avoid repeating

> Company Admin is permission-based

across multiple feature documents.

Document once in architecture and reference it elsewhere.

---

## 19. Introduce Architecture Decision Records (ADR)

Create a dedicated folder.

```
context/

└── architecture-decisions/

    ADR-001-platform-company-split.md

    ADR-002-role-permission-model.md

    ADR-003-tenant-bootstrap.md

    ADR-004-audit-logging.md

    ADR-005-user-management.md
```

Permanent architectural decisions should live here instead of review documents.

---

# Recommended Implementation Order

| Priority | Recommendation                 | Status |
| -------- | ------------------------------ | ------ |
| 🔴 P1    | Document User Architecture Divergence | ✅ Done 2026-07-14 (docs only) |
| 🔴 P1    | Domain Services                | Blocked — no Voucher/Accounting module exists yet |
| 🔴 P1    | Domain Events                  | ✅ Done 2026-07-14 |
| 🔴 P1    | Shared Transaction Manager     | ✅ Done 2026-07-14 |
| 🟠 P2    | Application vs Domain Services | Not started |
| 🟠 P2    | Standard Repository Results    | Not started |
| 🟠 P2    | Business Rule Specifications   | Not started |
| 🟠 P2    | Validation Layer               | Not started |
| 🟠 P2    | Error Codes                    | Not started |
| 🟡 P3    | Bootstrap Versioning           | Not started |
| 🟡 P3    | Module Contracts               | Not started |
| 🟡 P3    | Background Jobs                | Not started |
| 🟡 P3    | Aggregate Roots                | Not started |
| 🟡 P3    | Module Dependency Matrix       | Not started |
| 🟢 P4    | Module Registration            | Not started |
| 🟢 P4    | Audit Logging Standard         | Not started |
| 🟢 P4    | Documentation Cleanup          | Not started |
| 🟢 P4    | Authorization Consolidation    | Not started |
| 🟢 P4    | ADR Documentation              | Not started |

---

# Overall Recommendation

- **Complete Priority 1** before implementing the Accounting/Ledger modules.
- **Complete Priority 2** before Voucher, GST, and Inventory modules.
- **Complete Priority 3** before Reporting and Advanced Features.
- **Priority 4** can be implemented gradually as the project matures.

These improvements focus on scalability, maintainability, and long-term architectural consistency without requiring major refactoring of the current codebase.
