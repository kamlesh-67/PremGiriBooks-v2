# 30 - Pricing Engine

> Feature-spec file number 30 (spec-file numbers are sequential and never reused). This
> feature is `context/Phases/phase-tracker.md`'s Phase 2 — Core Business Foundation →
> **Pricing** item **#28 Pricing Engine** — the capstone of the Pricing group. Depends on
> Products (spec 25, implemented) + Customers (spec 26) + Price Lists (spec 29).
> **Implement only after specs 26, 28, and 29 are all complete.**

## Goal

Implement the **Pricing Engine** for **Premgiri Books ERP** — the first of the Core
Engines (`architecture-context.md`) and the sole owner of selling-price derivation
(Invariant 6: "Pricing is always calculated by the Pricing Engine"; code-standards.md:
"No screen may calculate selling prices directly").

The engine is a **service, not a screen**: it exposes a price-resolution API that future
Sales features (Quotations #33, Sales Orders #34, Sales Invoice #36, Barcode Billing #76)
call with a product + customer + quantity and get back a resolved price, its source, and
advisory flags. **This task ships no transactional UI** — there is nothing to sell yet.
It ships the engine, its one schema addition (`Customer.priceListId` — the
customer-specific-pricing assignment deferred from spec 29), and exhaustive tests.

Engines live in `src/engines/` (the folder reserved for them since feature-spec 01), not
`src/modules/` — they are shared business services consumed by modules, never the other
way around (`architecture-context.md` Module Boundaries: "Sales module communicates only
through Pricing/Inventory/Voucher/GST Engines").

---

# Project Context

Before implementation, review

- PRD.md (§12), architecture-context.md (Core Engines → Pricing Engine, Costing
  Strategy — Latest Purchase Cost, Engine Driven, Invariants 4–6), code-standards.md
  (Pricing Rules — the resolution and override rules this engine encodes),
  ai-workflow-rules.md, progress-tracker.md
- `context/Phases/phase-tracker.md` (Phase 2 → Pricing; the Sales phase #33–#39 that
  consumes this engine)
- `28-margin-profiles.md` (the MARGIN/MARKUP formulas this engine implements)
- `29-price-lists.md` (`findEffectiveLists`, quantity breaks, effective windows — the
  data this engine selects from)
- `26-customer-management.md` (`CustomerType`, and the Customer model this task extends)

---

# Module Responsibilities

The Pricing Engine is responsible for

- **Selling-price resolution** — one API, `resolvePrice`, applying the documented source
  order (below) and returning the price, its source, and advisory flags
- The margin/markup arithmetic from `28-margin-profiles.md` (implemented here and only
  here)
- Price-list selection: effective-window filtering, tier matching, quantity-break
  selection (data shipped by spec 29, chosen here)
- The `Customer.priceListId` assignment (schema + customer-form picker — the
  customer-specific-pricing hook deferred from spec 29 to keep that spec
  customer-independent)

The Pricing Engine is **not** responsible for

- Any UI beyond the Customer form's new Price List picker (no price-preview screens —
  consumers render prices when they exist)
- Enforcing the manual-override / below-cost / below-minimum-margin *permissions*
  (code-standards.md Pricing Rules) — the engine returns advisory flags; **enforcement
  happens at document time** by the consuming feature (Sales Invoice #36), which owns
  the interactive override flow. Recorded here so spec 36 inherits the requirement.
- Maintaining `Product.purchasePrice` (Latest Purchase Cost is entered manually today;
  Purchase Invoice #42 overwrites it later)
- GST (GST Engine, tracker #31), inventory availability (Inventory Engine, #30), or
  discounts-as-configuration (no discount master exists; a future spec adds one and
  extends the source order)

---

# Features

Implement

- `resolvePrice` — the resolution API (details below)
- `Customer.priceListId` — optional assignment, editable on the Customer form
- Pure-function core with exhaustive vitest coverage (this feature is mostly logic;
  tests are the deliverable that proves it)

No pages, no new hub cards, no breadcrumbs.

---

# Data Model

One schema change (plus a `customers Customer[]` back-relation on `PriceList`):

```text
// added to model Customer:
//   priceListId String?
//   priceList   PriceList? @relation(fields: [priceListId], references: [id])
//   @@index([priceListId])
```

Assignment follows the established reference rules: same-company + active at assignment
time, verified server-side inside the customer module's existing paired write
transaction; unchanged assignments are not re-verified on unrelated edits; a
since-deactivated assigned list stays visible on the edit form labeled "(Inactive)".

No other tables. **The engine owns no data** — it reads Products, Customers, Margin
Profiles, and Price Lists through their modules' services/repositories.

---

# Resolution Order (the core business rule)

`resolvePrice(input)` where input is:

```text
{
  productId: string          // required
  quantity: number           // required, > 0, honors the product unit's decimalPlaces
  customerId?: string        // a Permanent Customer, when known
  customerType?: CustomerType // explicit tier when no customerId (Quick/Walk-in billing)
  asOfDate?: Date            // defaults to today; documents pass their document date
}
```

The effective tier is: the customer's stored `customerType` when `customerId` is given,
else the explicit `customerType`, else `RETAIL` (the Walk-in default).

Sources are consulted in this order — **first hit wins**:

1. **Customer's assigned price list** (`customer.priceListId`, when the list is active
   and effective on `asOfDate`): the item for the product with the highest
   `minQuantity ≤ quantity`. A customer-assigned list is consulted regardless of its
   `customerType` restriction (explicit assignment beats tier matching —
   code-standards.md: "Customer-specific pricing overrides default pricing").
2. **Tier-matching effective price lists** (`findEffectiveLists` from spec 29, lists
   whose `customerType` equals the effective tier): among all matching items across
   those lists (quantity-break rule per list), **the lowest price wins** — deterministic
   and customer-favorable, so a live promotion is always honored. Document this
   tie-break in code.
3. **Tier-agnostic effective price lists** (`customerType = null`): same lowest-price
   rule.
4. **Margin Profile** (`product.marginProfileId`, when set and the profile is active):
   apply the profile's mode and the effective tier's percent to the **latest purchase
   cost** (`product.purchasePrice`). Skipped when `purchasePrice` is null (nothing to
   compute from) or the profile is inactive (spec 28's deactivation rule lands here).
   - `MARKUP`: price = cost × (1 + percent / 100)
   - `MARGIN`: price = cost / (1 − percent / 100)
5. **Product fallback** — `product.sellingPrice`, when set.
6. **No source** — resolved price is `null`; the consuming document requires manual
   entry (and its own override permission — not this engine's concern).

Result shape:

```text
{
  price: number | null
  source: "CUSTOMER_PRICE_LIST" | "PRICE_LIST" | "MARGIN_PROFILE" | "PRODUCT_DEFAULT" | "NONE"
  priceListId?: string
  priceListItemId?: string
  marginProfileId?: string
  isBelowCost: boolean       // price !== null && purchasePrice !== null && price < purchasePrice
  purchaseCost: number | null // echoed so consumers can render warnings without a second read
}
```

Additional rules

- All arithmetic on plain numbers (the repository boundary already normalizes Decimals),
  rounded to 2 decimals half-up at the end of step 4's formulas only — price-list and
  product prices are stored 2-decimal already. **No configurable rounding** (deferred,
  same decision as spec 28).
- `isBelowCost` is advisory (code-standards.md: "Selling below cost requires warning or
  approval" — the approval is document-time). A below-cost *price-list* price is legal
  (deliberate promotions) and still flagged.
- "Below minimum margin" (code-standards.md) is **not implemented** — no minimum-margin
  configuration exists anywhere; recorded as deferred until a spec adds that
  configuration, rather than inventing a config table nothing asked for.
- Inactive products: `resolvePrice` does not gate on `product.isActive` — document
  lookups already exclude inactive products (`listSelectableProducts`), and pricing a
  stored row must keep working (mirror of the unchanged-reference rule).

---

# Structure

Create

```text
src/engines/pricing/pricing-engine.ts        // the public API: resolvePrice
src/engines/pricing/price-resolution.ts      // pure core: pickBreakRow, applyProfile,
                                             // resolveFromSources — no I/O, fully unit-tested
src/engines/pricing/types.ts                 // input/result types (exported for consumers)
```

- `pricing-engine.ts` loads the needed rows via the existing module services/
  repositories (products, customers, margin-profiles, price-lists —
  `findEffectiveLists`), then delegates every decision to the pure functions in
  `price-resolution.ts`. Engines may import from modules; modules may import engine
  *types* but modules never re-implement engine logic (Invariant 4).
- **No Server Actions and no permission checks inside the engine** — it is a
  server-side service invoked by module services that have already gated permissions
  (the same trust boundary as repositories). Record this as the standing engine
  convention: every engine assumes an authorized, company-scoped caller and takes
  `companyId` explicitly from that caller, never from client input. The engine still
  verifies every loaded row belongs to the passed `companyId` (defense in depth).
- The Customer form change (Price List picker in a Credit/Pricing section) ships through
  the existing customer module: schema field, `verifyReferences`-style check in the
  paired transaction, picker fed by a new `listSelectablePriceLists()` on the
  price-lists service (active only, with the "(Inactive)" merge-in on edit).

---

# Validation

- Engine input validated with Zod at the engine boundary (`quantity > 0`, uuids,
  optional enum/date) — engines are system boundaries for their consumers even though
  they are not HTTP boundaries.
- Customer-side: `priceListId` optional uuid added to `customer-schema.ts`.

---

# Security

- The Customer form's new field rides the customer module's existing
  `assertPermission(user, "masters", …)` gates — no new catalog entries.
- The engine itself performs no permission checks (see Structure) — callers gate. Every
  read the engine performs is company-scoped by the callers' `companyId`.

---

# Database

One migration: `Customer.priceListId` (+ index + relations). No engine tables, no
seeding.

---

# Code Standards

Strict TypeScript, no `any`, pure-function core separated from I/O, no price math
outside `src/engines/pricing/` (grep-able invariant — the spec-28/29 masters and all
UI stay math-free), Zod at the engine boundary, vitest coverage as the primary
deliverable:

- source-order matrix (each source winning; each source skipped for each documented
  reason)
- quantity-break selection (exact break, between breaks, below lowest break, decimal
  quantities)
- effective-window filtering incl. inclusive boundaries and open-ended windows
- lowest-price tie-break within a bucket
- MARGIN vs MARKUP arithmetic incl. the 2-decimal rounding and the margin <100 domain
- `isBelowCost` flag matrix
- tier defaulting (customer tier / explicit tier / RETAIL fallback)

---

# Do Not

Do not implement

- Any Sales/Purchase document, billing screen, or price-preview UI
- Override/approval flows (Sales Invoice #36 owns them, consuming this engine's flags)
- Minimum-margin configuration or enforcement (deferred — see Resolution Order)
- Discount rules, schemes, or coupon mechanics (no master exists; future spec)
- Rounding configuration
- Caching layers (Postgres + per-request loads are fine at this scale; measure first)
- Changes to how `Product.purchasePrice` is maintained
- Inventory, GST, or voucher behavior of any kind

---

# Success Criteria

Verify

- `resolvePrice` returns the documented source order across the full vitest matrix
  above; all tests green.
- A customer with an assigned effective list gets its price even when a tier list is
  cheaper (explicit assignment wins); with no assignment, the cheapest
  simultaneously-effective matching list wins; with no lists, the margin profile
  computes tier-correct MARGIN/MARKUP prices from `purchasePrice`; with nothing,
  `product.sellingPrice`, then `null`/`NONE`.
- A below-cost resolution flags `isBelowCost` without blocking.
- `Customer.priceListId` assignment round-trips on the Customer form with the
  established reference rules (inactive/cross-company rejected at assignment,
  since-deactivated kept visible).
- No selling-price arithmetic exists outside `src/engines/pricing/`.
- `npx tsc --noEmit`, `npx eslint src prisma`, `npx vitest run`, and `next build` all
  pass.

Completing this spec completes `context/Phases/phase-tracker.md`'s Phase 2 **Pricing**
group; Phase 2 overall remains In Progress (Shared ERP Engines #29–#32 remain — specs
31–34).
