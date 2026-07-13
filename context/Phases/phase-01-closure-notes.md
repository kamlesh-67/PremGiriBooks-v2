# Phase 01 Closure Notes

## Phase 01 Status

Phase 01 (Foundation) is considered functionally complete. Authentication, Company Management,
Financial Year Management, User Management, and Role & Permission Management have been implemented
and reviewed. Branch Management begins Phase 02.

## Phase 01 Closure Decisions

The following architecture decisions are now considered closed and should be treated as project
standards going forward:

- Repository → Service → Server Action → UI remains the standard module architecture.
- Company-scoped authorization remains the default for business entities.
- Serializable transactions with bounded retries remain the standard for business invariants.
- All future authorization should use `assertPermission()` instead of introducing new
  Administrator-only checks.
- Roles remain system-wide (not company-specific).
- Permissions remain Module × Action based until real business modules require finer granularity.
- Company, Financial Year and Branch are the only application-wide operational contexts.
  Additional global contexts (Warehouse, Department, etc.) require explicit justification.
- Operational selections (Company, Financial Year, Branch) continue to be cookie-based rather than
  embedded into the authentication session.

## Phase 01 Cleanup Tasks (Before Phase 02)

Complete these small platform improvements before implementing additional ERP modules:

1. Introduce a shared Server Action error handling utility.
2. Standardize all `toErrorMessage()` implementations.
3. Add a self-service Change Password / My Profile feature.
4. Keep the Permission catalog empty-state as a documented assumption.
5. Retain global username/email uniqueness as an intentional product decision.

## Platform Improvements

These should be completed before major ERP modules (Sales, Purchase, Inventory, Accounting):

- Shared Action Error Handler.
- Shared CRUD utilities.
- Audit logging abstraction/interface.
- Lightweight internal Domain Event dispatcher.
- Shared Document Numbering service interface.

## Recommended Phase 02 Order

1. Branch Management
2. Document Numbering Engine
3. Audit Log Engine
4. File Manager
5. Import Framework
6. Export Framework
7. Backup & Restore
8. Notification System

## Tracker Updates

The previous "Open Questions" related to:
- Role scope
- Permission scope
- Context model
- Cookie vs Session selection storage
- Branch selection behaviour

are considered resolved by architectural decision and should be removed from the tracker.

Only implementation work items should remain open after Phase 01 closure.
