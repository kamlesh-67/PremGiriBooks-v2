# 28 - Margin Profiles

> Feature-spec file number 28 (spec-file numbers are sequential and never reused). This
> feature is `context/Phases/phase-tracker.md`'s Phase 2 — Core Business Foundation →
> **Pricing** item **#26 Margin Profiles** — the first of three Pricing features
> (#26 Margin Profiles → #27 Price Lists → #28 Pricing Engine, in that dependency order).
> Depends on Product Management (feature-spec 25, implemented).

## Goal

Implement **Margin Profiles** for **Premgiri Books ERP** — named, reusable
percentage-based pricing rules (`PRD.md` §12, code-standards.md Pricing Rules: "Margin
Profiles generate selling prices") that the Pricing Engine (tracker #28) will apply to a
product's latest purchase cost to derive tier-wise selling prices.

A Margin Profile stores **data only**: a calculation mode (Margin or Markup — the
company-choosable modes from `PRD.md` §12) and one percentage per customer tier (Retail /
Wholesale / Dealer / Distributor — the tiers `26-customer-management.md`'s `CustomerType`
enum established). **No price is calculated anywhere in this task** — the formulas are
*documented* here so the profile's fields are unambiguous, but applying them is
exclusively the Pricing Engine's job (`architecture-context.md` Invariant 6, Engine
Driven).

This task also adds the assignment point: an optional `marginProfileId` on `Product`.

---

# Project Context

Before implementation, review

- PRD.md (§12 Pricing & Margin System), project-overview.md (Pricing Engine feature
  list), architecture-context.md (Engine Driven, Costing Strategy — Latest Purchase
  Cost), code-standards.md (Pricing Rules), ui-context.md, ai-workflow-rules.md,
  progress-tracker.md
- `context/Phases/phase-tracker.md` (this feature's place in Phase 2 → Pricing, and the
  Price Lists #27 / Pricing Engine #28 features that build on it)
- `25-product-management.md` (the `Product` model this task extends with
  `marginProfileId`, and its reference-verification pattern for optional master links)
- `23-gst-rate-management.md` (the flat company-scoped master template with Decimal
  columns — the closest structural precedent, including the two-decimal refine and the
  Decimal→number repository normalization)

---

# Module Responsibilities

The Margin Profiles module is responsible for

- Margin Profile Master (Create/Edit/View/Activate/Deactivate, scoped to the active
  company)
- The `Product.marginProfileId` assignment (via the existing Product form — see UI)
- A reusable lookup the Product form and the Pricing Engine read (active profiles only)

The Margin Profiles module is **not** responsible for

- Calculating any price, margin, or markup (Pricing Engine, tracker #28)
- Price Lists or fixed per-product prices (tracker #27)
- Discount rules, promotional pricing, quantity pricing (Pricing Engine territory,
  driven by Price List data)
- The Latest Purchase Cost value itself (`Product.purchasePrice`, maintained manually
  today and by Purchase Invoice #42 later)

---

# Features

Implement

- Create Margin Profile
- Edit Margin Profile
- View Margin Profiles (list with search + status filter)
- Activate Margin Profile
- Deactivate Margin Profile
- Assign/unassign a Margin Profile on a Product (extending the existing Product form's
  Pricing section)

Do not implement delete. Matching every other master in this codebase, Margin Profiles
are never permanently deleted.

---

# Data Model

Add to `prisma/schema.prisma` (plus `marginProfiles MarginProfile[]` on `Company`, a
`products Product[]` back-relation on `MarginProfile`, and the new optional column on
`Product`):

```text
enum PriceCalculationMode {
  MARGIN
  MARKUP
}

model MarginProfile {
  id                 String               @id @default(uuid())
  companyId          String
  company            Company              @relation(fields: [companyId], references: [id])
  name               String
  calculationMode    PriceCalculationMode @default(MARGIN)
  retailPercent      Decimal              @db.Decimal(5, 2)
  wholesalePercent   Decimal              @db.Decimal(5, 2)
  dealerPercent      Decimal              @db.Decimal(5, 2)
  distributorPercent Decimal              @db.Decimal(5, 2)
  description        String?
  isActive           Boolean              @default(true)
  createdAt          DateTime             @default(now())
  updatedAt          DateTime             @updatedAt

  @@unique([companyId, name])
  @@index([companyId])
}

// added to model Product:
//   marginProfileId String?
//   marginProfile   MarginProfile? @relation(fields: [marginProfileId], references: [id])
//   @@index([marginProfileId])
```

Field decisions

- **One percentage per customer tier, all four required** (a profile that omits a tier
  would force the Pricing Engine to invent a fallback; a company that prices every tier
  identically simply enters the same number four times). The four columns mirror
  `CustomerType`'s four values by design — if a tier is ever added, both change together.
- `calculationMode` — how the Pricing Engine will interpret the percentages
  (`PRD.md` §12's company choice, stored per profile rather than per company so mixed
  strategies are possible). For the record — the formulas the Pricing Engine will apply,
  **not implemented here**:
  - `MARKUP`: sellingPrice = cost × (1 + percent / 100)
  - `MARGIN`: sellingPrice = cost / (1 − percent / 100) — hence the < 100 bound below
- Percentages — `Decimal(5,2)`, ≥ 0. `MARGIN` mode requires every percent < 100 (the
  formula divides by 1 − p/100); `MARKUP` allows up to 999.99. Enforced in Zod
  (mode-dependent `superRefine`, the `hsn-code-schema` shape) — no DB CHECK, per the
  established convention (Zod is the enforcement point; every write parses through it).
- `Product.marginProfileId` — optional. Not every product is auto-priced; products
  without a profile fall through to other Pricing Engine sources. Assignment follows
  `25-product-management.md`'s reference rules verbatim: verified same-company + active
  **at assignment time**, unchanged references never re-checked on unrelated edits.
- **No rounding configuration** — deliberately deferred. Rounding policy (nearest rupee,
  95-paise endings, etc.) belongs to the Pricing Engine's calculation options if a real
  requirement emerges; a config column nothing reads is dead data (YAGNI).
- **No category/brand-level profile defaults** — assignment is per-product only.
  Hierarchical defaulting is speculative generality until a user asks for it.

**No `isSystemDefined` and no seeding — deliberate**, same reasoning as every master
since Units.

---

# Business Rules

- `name` unique per company (DB-enforced); field-specific friendly message on conflict.
- Mode-dependent percentage bounds (see Data Model) validated at the boundary; all four
  tier percentages required on create and update.
- Deactivating a profile follows the established master convention: existing
  `Product.marginProfileId` references are **kept** (the product's pricing simply stops
  resolving through it — Pricing Engine rule, documented there); the profile disappears
  from the Product form's picker for new assignments (`listSelectableMarginProfiles`).
  Editing a product without touching the assignment stays possible (the
  unchanged-reference rule from spec 25). No invariant blocks deactivation.
- Changing a profile's percentages or mode takes effect the next time the Pricing Engine
  computes a price — nothing is denormalized onto products, so there is nothing to
  recompute or backfill.
- **Company-scoped for every user** via `getCurrentCompanyUser()`; cross-company ids
  resolve as not-found.

---

# Service / Repository

Create

```text
src/modules/margin-profiles/repositories/margin-profile-repository.ts
src/modules/margin-profiles/services/margin-profile-service.ts
src/modules/margin-profiles/validation/margin-profile-schema.ts
src/modules/margin-profiles/actions/margin-profile-actions.ts
src/modules/margin-profiles/components/…
src/types/margin-profile.ts
```

- `marginProfileService`: `listMarginProfiles(filters)` (status/name-search),
  `getMarginProfile(id)`, `createMarginProfile(input)`, `updateMarginProfile(id, input)`,
  `activateMarginProfile(id)`, `deactivateMarginProfile(id)`, and
  `listSelectableMarginProfiles()` (active only — consumed by the Product form now and
  the Pricing Engine later).
- Repository normalizes the four Decimal percent columns to plain `number` before
  anything leaves it (the GstRate convention), so `src/types/margin-profile.ts` exposes
  numbers. Read-check-write inside `runInTransaction`; no Serializable isolation — no
  cross-row invariant exists (same reasoning as GstRate/Brand).
- **Product-side change**: extend `product-repository.ts`'s `verifyReferences()` to cover
  `marginProfileId` (same-company + active at assignment time — it becomes the seventh
  verified reference), extend `product-schema.ts` with the optional uuid, and add the
  profile picker to the Product form's Pricing section via the existing
  `ProductOptionSelector` + `buildProductFormOptions` (including the "(Inactive)"
  merge-in for edit pages, the established convention).
- Server Actions use the shared `runAction` envelope.

---

# Validation

Zod (`margin-profile-schema.ts`):

- Name — required, trimmed, 2–100 characters
- Calculation Mode — required enum: `MARGIN` / `MARKUP` (export a plain string-literal
  tuple for the client, the `HSN_CODE_TYPES` convention)
- Retail / Wholesale / Dealer / Distributor Percent — each required, ≥ 0, max 2 decimal
  places (the `hasAtMostTwoDecimals` tolerance refine from `gst-rate-schema.ts`);
  object-level `superRefine`: every percent < 100 when mode is `MARGIN`, ≤ 999.99 when
  `MARKUP`
- Description — optional, max 500, blank→undefined

Create and Update accept the same field set.

---

# UI

Pages (under the existing **Masters** hub)

- `/masters/margin-profiles` — list (Name, Mode, Retail %, Wholesale %, Dealer %,
  Distributor % — all four `font-financial` right-aligned `toFixed(2)` — Status, Actions)
- `/masters/margin-profiles/new` — Create
- `/masters/margin-profiles/[id]/edit` — Edit

Components (`src/modules/margin-profiles/components/`): Margin Profile Table, Margin
Profile Form (single form for create and edit — the established simplification), Status
Badge. The form shows a static explanatory line for the selected mode (e.g. "Margin:
price = cost ÷ (1 − % / 100)") — display text only, no calculation.

Wire-up

- "Margin Profiles" card on the `/masters` hub (lucide `Percent` is taken by GST Rates —
  use `TrendingUp`).
- `"margin-profiles": "Margin Profiles"` in `src/constants/breadcrumbs.ts`.
- Product form: Margin Profile picker added to the existing Pricing section (see
  Service / Repository). No sidebar change.

---

# Security

Every action gates via `assertPermission(user, "masters", …)` — `view` for reads,
`create`/`edit` for writes, `delete` for Activate/Deactivate (the documented convention).
No Permission catalog changes. Margin Profiles are listed under Masters in
`architecture-context.md`'s Module Boundaries — same placement reasoning as every prior
master.

All reads/writes scoped to the requesting user's own company.

---

# Database

New model `MarginProfile`, new enum `PriceCalculationMode`, new optional column
`Product.marginProfileId` (+ index and relations). One migration. No seeding, no
bootstrap changes, no data backfill (the new Product column is nullable).

---

# Code Standards

Strict TypeScript, no `any`, Repository → Service → Server Action → UI, **no price math
anywhere** (not even preview values in the form — Engine Driven), Zod at the boundary,
Pino via the shared error helpers, vitest coverage for the schema (including the
mode-dependent bound matrix).

---

# Do Not

Do not implement

- Any selling-price calculation, preview, or "effective price" display (Pricing Engine,
  tracker #28)
- Price Lists (feature-spec 29 / tracker #27 — next in this group)
- Discount rules, promotional or quantity pricing
- Rounding configuration (deferred — see Data Model)
- Category/brand-level profile defaults (per-product assignment only)
- Per-company default calculation mode settings (the mode lives on each profile)
- Changes to `Product.purchasePrice` semantics (Latest Purchase Cost is Purchase Invoice
  #42's job)
- Delete endpoints

---

# Success Criteria

Verify

- Profiles can be created/edited/listed/activated/deactivated, scoped to the active
  company; duplicate names get a friendly field-specific error.
- A `MARGIN`-mode profile rejects any percent ≥ 100; a `MARKUP`-mode profile accepts up
  to 999.99; both reject 3-decimal values.
- A product can be assigned a profile, unassigned, and edited without touching a
  since-deactivated assigned profile; assigning an inactive or cross-company profile is
  rejected server-side.
- Deactivating an assigned profile leaves products intact and removes it from pickers
  only.
- No calculation of any kind exists in the diff (grep for the formula symbols in
  components/services — they may appear only in comments and display strings).
- No delete is possible anywhere.
- `/masters` hub shows the card; breadcrumbs resolve.
- `npx tsc --noEmit`, `npx eslint src prisma`, `npx vitest run`, and `next build` all
  pass.

Feature-spec 28 (this spec) is `context/Phases/phase-tracker.md`'s Phase 2 **Pricing**
item #26. Price Lists (feature-spec 29, tracker #27) builds directly on it.
