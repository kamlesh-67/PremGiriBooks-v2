# 33 - GST Engine

> Feature-spec file number 33 (spec-file numbers are sequential and never reused). This
> feature is `context/Phases/phase-tracker.md`'s Phase 2 — Core Business Foundation →
> **Shared ERP Engines** item **#31 GST Engine**. Depends on GST Rates (spec 23) and HSN
> (spec 22), both implemented. Independent of the Voucher, Inventory, and Document
> Number engines — it can land in any order relative to them.

## Goal

Implement the **GST Engine** for **Premgiri Books ERP** — the sole owner of GST
arithmetic (`architecture-context.md` Invariant 8: "GST calculations are managed only by
the GST Engine"; code-standards.md GST Rules: "No module may manually calculate GST").

This engine is **pure calculation — no schema, no UI, no persistence**. It exposes
supply-type determination, line-level tax calculation (exclusive and inclusive prices),
and document-level aggregation that every future taxed document calls: Sales Invoice
(#36), Purchase Invoice (#42), Credit/Debit Notes (#38/#39), returns (#37/#43). The GST
*reports* (Registers #54, GSTR-1 #55, GSTR-3B #56, HSN Summary #57) are Phase 7 — they
aggregate posted document data that does not exist yet, and are **not** built here.

The intra/inter-state split deferred since `23-gst-rate-management.md` ("the
intra/inter-state split is pure arithmetic owned exclusively by the GST Engine") lands
here, as does the formal GST state-code list deferred since specs 26/27 ("the GST Engine
owns formalizing place-of-supply state codes").

---

# Project Context

Before implementation, review

- PRD.md, architecture-context.md (Core Engines → GST Engine, Invariant 8),
  code-standards.md (GST Rules — "Place of Supply determines GST type", "Manual GST
  adjustment must be auditable"), ai-workflow-rules.md, progress-tracker.md
- `context/Phases/phase-tracker.md` (Shared ERP Engines; Phase 7 GST reports that build
  on this)
- `23-gst-rate-management.md` (`GstRate` stores **total** rate + cess only — the split
  computed here; the statutory 0.25% slab that mandates 2-decimal rates)
- `22-hsn-management.md` (HSN/SAC semantics; "HSN Code is mandatory where applicable" is
  a *document* validation, aided by a helper here)
- `30-pricing-engine.md` / `31-voucher-engine.md` / `32-inventory-engine.md` (the
  standing engine conventions — this is the purest engine of the four: no repository at
  all)

---

# Module Responsibilities

The GST Engine is responsible for

- **Supply-type determination**: place of supply vs. the company's state → intra-state
  (CGST + SGST) or inter-state (IGST)
- **Line calculation**: taxable value, CGST/SGST/IGST/CESS amounts from a total rate +
  cess, for both tax-exclusive and tax-inclusive prices
- **Document aggregation**: per-rate tax totals across lines (the shape invoice footers
  and, later, GST reports need)
- The canonical **GST state-code list** (01–38) as shared constants
- Reverse-charge flagging (pass-through metadata — the arithmetic is identical; the
  liability shifts, which registers report later)

The GST Engine is **not** responsible for

- Persisting anything (documents store the computed tax lines they post; vouchers carry
  the GST ledger entries — both future specs)
- GST reports/returns of any kind (Phase 7, #54–#57)
- Choosing which rate applies to a product (the product's assigned `GstRate`/HSN — the
  calling document passes the numbers)
- Validating GST *registration* data (GSTIN format lives in the party/company schemas)
- E-Invoice / E-Way Bill (out of scope for the initial release)

---

# API (the deliverable)

Create

```text
src/engines/gst/gst-engine.ts       // public API re-exports
src/engines/gst/gst-calculation.ts  // pure functions below — no I/O anywhere
src/engines/gst/state-codes.ts      // GST_STATE_CODES constant
src/engines/gst/types.ts
```

All functions are pure and synchronous. All money math is integer-paise internally
(the spec-31 convention), returned as 2-decimal numbers.

- `GST_STATE_CODES` — the statutory list: code ("01"–"38", including "26" merged
  DNH&DD, "31" Lakshadweep, "38" Ladakh, plus "96"/"97" other-territory/OIDAR entries
  only if trivially useful — decide during implementation and record) with names.
  Exported as a readonly tuple + lookup map. **No migration of the existing free-text
  `state` columns** on Company/Customer/Supplier — documents will capture place of
  supply explicitly per transaction (an invoice's place of supply is not always the
  customer's master address); mapping master addresses to codes stays deferred until a
  document spec needs a default (recorded forward-note, closing the spec-26/27 deferral
  the way it anticipated).
- `determineSupplyType(companyStateCode, placeOfSupplyStateCode)` →
  `"INTRA_STATE" | "INTER_STATE"` — equal codes → intra (code-standards.md: "Place of
  Supply determines GST type").
- `calculateLine(input)`:

  ```text
  {
    amount: number            // line amount, > 0
    isInclusive: boolean      // false: amount is taxable value; true: amount includes GST+cess
    ratePercent: number       // total GST rate (0–100, 2 decimals) from the GstRate master
    cessPercent: number       // 0–100, 2 decimals
    supplyType: "INTRA_STATE" | "INTER_STATE"
    isReverseCharge?: boolean // default false, echoed through
  }
  →
  {
    taxableAmount, cgst, sgst, igst, cess, totalTax, totalAmount, isReverseCharge
  }
  ```

  Rules: exclusive → tax = taxable × rate/100; inclusive → taxable = amount / (1 +
  (rate + cess)/100), back-calculated. Intra: CGST = SGST = tax/2 (each rounded
  half-up to 2 decimals — the statutory halves of 18% are 9% + 9%; an odd paisa after
  halving goes to CGST, documented); inter: IGST = full tax. Cess always on the
  taxable value. Zero rate (exempt/nil) flows through with zeros.
- `calculateDocument(lines)` → per-rate groups (`ratePercent` → taxable/cgst/sgst/
  igst/cess sums) + document totals. **Rounding policy: round per line, sum the
  rounded lines** — document totals are exact sums of line values so a printed invoice
  always foots; final invoice-total rounding to the rupee (and its round-off ledger
  entry) is the document's concern, not this engine's (recorded so spec 36 inherits
  it).
- `isHsnRequired(codeTypeExpected, hsnCode?)` — small helper documents will use for
  "HSN Code is mandatory where applicable" (applicable = taxed line; threshold-based
  digit rules are a Phase 7 reporting concern).

Manual GST adjustment ("must be auditable", code-standards.md) is **not** an engine
capability — a document that overrides computed tax stores both computed and overridden
values and its own audit trail; forward-noted for spec 36/42.

---

# Validation

Zod at the engine boundary: amount > 0 finite, percents 0–100 with max 2 decimals
(`hasAtMostTwoDecimals`), enums, non-empty lines array for aggregation. Invalid state
codes rejected by `determineSupplyType` (must exist in `GST_STATE_CODES`).

---

# Security

No permission checks (engine convention — callers gate) and no data access at all: the
engine is deterministic arithmetic. Nothing here is company-scoped because nothing here
touches storage.

---

# Database

**No schema changes, no migration.** (First feature since spec 17 to ship none —
correct, not an omission.)

---

# Code Standards

Strict TypeScript, no `any`, pure functions only, integer-paise arithmetic, vitest as
the primary deliverable:

- intra/inter split incl. the odd-paisa halving rule and equal/unequal state codes
- exclusive and inclusive calculation, incl. inclusive-with-cess back-calculation
  round-trips (calculate inclusive → re-apply exclusive → original within 1 paisa)
- the statutory slabs 0, 0.25, 3, 5, 12, 18, 28 (+ cess cases) against hand-computed
  fixtures
- per-rate document aggregation and the sum-of-rounded-lines policy
- zero-rate and reverse-charge pass-through
- state-code lookup and rejection matrix

---

# Do Not

Do not implement

- Any persistence, schema, migration, or repository
- GST reports, registers, or returns (#54–#57), HSN summaries, or filing exports
- Screens of any kind
- Rate lookup from products/HSN (callers pass numbers from the masters)
- Invoice-total round-off or its ledger entry (document concern, forward-noted)
- Free-text state → state-code backfill on existing masters (deferred to the document
  specs; see API)
- E-Invoice, E-Way Bill, GST portal integration (Future Roadmap)
- Threshold-based HSN digit-count rules (Phase 7)

---

# Success Criteria

Verify

- The full vitest matrix above is green; every documented rule has at least one test
  pinning it (odd-paisa CGST rule, inclusive back-calculation, sum-of-rounded-lines).
- `determineSupplyType` + `calculateLine` + `calculateDocument` compose to correct
  totals for a realistic multi-line, mixed-rate fixture in both intra- and inter-state
  variants.
- No GST arithmetic exists outside `src/engines/gst/` (grep-able, matching the pricing
  engine's invariant).
- No schema diff, no new routes.
- `npx tsc --noEmit`, `npx eslint src prisma`, `npx vitest run`, and `next build` all
  pass.

Feature-spec 33 (this spec) is `context/Phases/phase-tracker.md`'s Phase 2 **Shared ERP
Engines** item #31.
