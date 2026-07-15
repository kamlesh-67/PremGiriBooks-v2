# 22 - HSN Management

> Feature-spec file number 22 (spec-file numbers are sequential and never reused). This
> feature is `context/Phases/phase-tracker.md`'s Phase 2 — Core Business Foundation →
> **Inventory Masters** item **#20 HSN Management**.

## Goal

Implement **HSN Management** for **Premgiri Books ERP** — the master list of HSN codes
(Harmonized System of Nomenclature, for goods) and SAC codes (Services Accounting Code, for
services) that Product Management (tracker #23) will reference and that the GST Engine
(tracker #31) and GSTR-1's HSN Summary (tracker #57) will later consume per invoice line.

Per `context/Phases/phase-tracker.md`, HSN Management depends only on Database Foundation.
It mirrors the flat company-scoped-master pattern of `19-unit-management.md`.

Do **not** implement Category, Brand, GST Rate, Warehouse, or Product Management in this
task (specs 20–21, 23–25), and do not implement any GST calculation.

---

# Project Context

Before implementation, review

- PRD.md, project-overview.md, architecture-context.md, code-standards.md, ui-context.md,
  ai-workflow-rules.md, progress-tracker.md
- `context/Phases/phase-tracker.md` (this feature's place in Phase 2 → Inventory Masters)
- `19-unit-management.md` (the template this task mirrors: Repository → Service → Server
  Action → UI, `assertPermission()`, company-scoped reads/writes, Activate/Deactivate
  instead of delete, shared `runAction` envelope in `src/lib/run-action.ts` — and the
  precedent of storing a GST-adjacent code as plain data now, formalized by the GST Engine
  later, exactly like Unit's `uqcCode`)

---

# Module Responsibilities

The HSN module is responsible for

- HSN/SAC Code Master (Create/Edit/View/Activate/Deactivate, scoped to the active company)
- A reusable lookup future Product Management reads from (active codes only)

The HSN module is **not** responsible for

- GST rates or any rate-to-HSN mapping (GST Rate Management is spec 23; a per-HSN default
  rate, if ever wanted, belongs to the GST Engine, tracker #31 — see Do Not)
- GST calculation, HSN Summary, GSTR-1/3B (GST Engine #31, Phase 7)
- Validating codes against the official government HSN directory (offline-first app; the
  master is user-maintained)

---

# Features

Implement

- Create HSN/SAC Code
- Edit HSN/SAC Code (all fields)
- View HSN/SAC Codes (list)
- Activate HSN/SAC Code
- Deactivate HSN/SAC Code

Do not implement delete. Matching every other master in this codebase, HSN codes are never
permanently deleted.

---

# Data Model

Add to `prisma/schema.prisma` (plus `hsnCodes HsnCode[]` on `Company`):

```text
enum HsnCodeType {
  HSN
  SAC
}

model HsnCode {
  id          String      @id @default(uuid())
  companyId   String
  company     Company     @relation(fields: [companyId], references: [id])
  code        String
  codeType    HsnCodeType @default(HSN)
  description String
  isActive    Boolean     @default(true)
  createdAt   DateTime    @default(now())
  updatedAt   DateTime    @updatedAt

  @@unique([companyId, code])
  @@index([companyId])
}
```

- `code` — the digits themselves, e.g. `"4901"` (printed books) or `"998599"` (a SAC).
  Unique per company across both code types (HSN and SAC ranges don't meaningfully collide,
  and one uniqueness rule keeps the lookup unambiguous).
- `codeType` — `HSN` for goods, `SAC` for services. `architecture-context.md`'s Product
  Architecture supports Trading Product / Service / Expense Item product types, so the
  master must hold both families from day one; a one-column enum is the least-invented way
  to distinguish them.
- `description` — **required** (unlike other masters' optional descriptions): GSTR-1's HSN
  Summary reports a description per code line, and a bare number is meaningless in the
  Product form's picker.

**Company-scoped, not global — deliberate.** HSN codes are statutory and identical across
businesses, but this codebase's tenant-isolation rule (`architecture-context.md`) makes
company-scoped the default for every business entity, each company only maintains the
handful of codes it actually trades in, and a global table would need its own
admin/ownership story. **No seeding** — the official directory has thousands of entries and
each business uses a few; every code is user-created (same reasoning as Units).

---

# Business Rules

- `code` unique within the company (DB-enforced). Surface the conflict with a friendly
  field-specific message.
- **All fields remain editable**, including `code` and `codeType` — nothing references an
  HSN row until Product Management exists. Forward-compatible rule to record now: once
  transactional documents (Sales/Purchase Invoices) reference HSN data on posted lines,
  those documents must snapshot the code at posting time (Voucher/GST Engine concern), so
  editing the master never rewrites filed returns. Nothing to check against yet.
- Deactivation has no invariant to guard — a plain scoped update. Active products
  referencing a deactivated code keep their reference (once products exist); selectable
  lookups list active codes only.
- **Company-scoped for every user.** Derive the active company server-side from the
  requesting user's own session (`getCurrentCompanyUser()`); never accept a company id from
  the client. Treat "belongs to a different company" identically to "not found."

---

# Service / Repository

Create

```text
src/modules/hsn-codes/repositories/hsn-code-repository.ts
src/modules/hsn-codes/services/hsn-code-service.ts
src/modules/hsn-codes/validation/hsn-code-schema.ts
src/modules/hsn-codes/actions/hsn-code-actions.ts
src/modules/hsn-codes/components/…
src/types/hsn-code.ts
```

- `hsnCodeService`: `listHsnCodes(filters)` (status/search/codeType filters),
  `getHsnCode(id)`, `createHsnCode(input)`, `updateHsnCode(id, input)`,
  `activateHsnCode(id)`, `deactivateHsnCode(id)`, and `listSelectableHsnCodes()` (active
  only — the lookup Product Management will consume, filterable by `codeType` so the Product
  form can offer HSN codes to goods and SAC codes to services).
- Repository mirrors `unit-repository.ts`: `findMany(companyId, filters)`, scoped
  `update`/`activate`/`deactivate` running their read-check-write inside `runInTransaction`.
- Server Actions use the shared `runAction` envelope (`src/lib/run-action.ts`).

---

# Validation

Zod (`hsn-code-schema.ts`):

- Code — required, trimmed, digits only; when `codeType` is `HSN`: exactly 4, 6, or 8
  digits (the lengths GSTR-1 accepts); when `codeType` is `SAC`: exactly 6 digits
- Code Type — required enum, `HSN` or `SAC`
- Description — required, trimmed, 2–200 characters

Create and Update accept the same field set.

---

# UI

Pages (under the existing **Masters** hub)

- `/masters/hsn-codes` — HSN/SAC list (Code, Type, Description, Status, Actions)
- `/masters/hsn-codes/new` — Create HSN/SAC Code
- `/masters/hsn-codes/[id]/edit` — Edit HSN/SAC Code

Components (`src/modules/hsn-codes/components/`): HSN Code Table, HSN Code Form, HSN Code
Edit Form, HSN Code Status Badge, plus a small Code Type badge (HSN vs SAC) in the list.

Wire-up

- Add an "HSN Codes" card to the `/masters` hub page (`src/app/masters/page.tsx`), matching
  the existing card convention (lucide `Hash` icon).
- Add `"hsn-codes": "HSN Codes"` to `src/constants/breadcrumbs.ts`.
- The Sidebar's Masters entry already links to `/masters` — no sidebar change.

The `/masters` hub page's coarse `isCurrentUserCompanyAdmin()` gate remains a known
pre-existing inconsistency, out of scope (recorded in `19-unit-management.md`).

---

# Security

Every action gates via `assertPermission(user, "masters", …)` — `view` for list/detail
reads, `create`/`edit` for writes, and `delete` for Activate/Deactivate (the documented
convention since `ledger-service.ts`). No Permission catalog changes.

All reads/writes scoped to the requesting user's own company (see Business Rules).

---

# Database

New model: `HsnCode`, new enum `HsnCodeType`. New migration. No seeding, no
bootstrap/domain-event changes, no changes to any existing table beyond `Company.hsnCodes`.

---

# Code Standards

Strict TypeScript, no `any`, Repository → Service → Server Action → UI, no business logic in
components, Zod validation at the boundary, Pino logging via the shared error helpers.

---

# Do Not

Do not implement

- Category / Brand / GST Rate / Warehouse / Product Management (specs 20–21, 23–25)
- Any GST calculation, HSN Summary, or return artifact (GST Engine #31, Phase 7)
- A default-GST-rate field on `HsnCode` or any HSN→rate mapping (the GST Engine owns that
  decision — same deferral posture as Unit's `uqcCode`)
- Seeding or importing the official HSN directory
- Delete endpoints

---

# Success Criteria

Verify

- HSN/SAC codes can be created/edited/listed/activated/deactivated, scoped to the active
  company only.
- HSN codes accept exactly 4, 6, or 8 digits; SAC codes exactly 6; non-digit input is
  rejected.
- Description is required; duplicate code produces a field-specific friendly error.
- A code belonging to another company resolves as "not found" for every operation.
- No delete is possible anywhere.
- `/masters` hub shows the HSN Codes card; breadcrumbs label `/masters/hsn-codes` as
  "HSN Codes".
- `npx tsc --noEmit`, `npx eslint src prisma`, `npx vitest run`, and `next build` all pass.
