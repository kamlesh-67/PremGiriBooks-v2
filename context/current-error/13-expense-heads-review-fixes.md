# 13 — Expense Heads review nitpicks: verification and fixes (2026-07-14)

Two nitpick-level review comments were pasted against the Feature-spec 16 (Expense Heads) changeset,
immediately after its implementation the same day. Per the established discipline
(`11-review-batch-fixes-round2.md`), each was verified against the live working-tree code before
acting — one was fixed, one was skipped with reasoning.

## Finding 1 — duplicated action boilerplate in `expense-head-actions.ts` — VERIFIED VALID, FIXED

**Claim:** the four expense-head Server Actions (create/update/activate/deactivate) each repeat the
same try → service call → `revalidatePath` → success/error-envelope structure; extract a shared
wrapper, reusing the pattern from `ledger-actions.ts`.

**Verified:** true — all four actions in `src/modules/ledgers/actions/expense-head-actions.ts`
repeated the identical ~9-line block, and `src/modules/ledgers/actions/ledger-actions.ts`'s four
actions repeated the same block a further four times (the duplication's original source).

**Fix:**

- New `src/modules/ledgers/actions/run-ledger-action.ts` — `runLedgerAction(operation, revalidatePaths)`,
  which runs the service operation, revalidates each given route on success, and translates errors
  through the existing shared `toActionErrorMessage` envelope. It lives in its own (non-`"use server"`)
  module because a `"use server"` file may only export async Server Actions — a shared helper cannot
  be exported from either action file itself.
- Both `expense-head-actions.ts` and `ledger-actions.ts` (not just the file the finding named — fixing
  only the copy would have left the original duplication in place) now delegate to it; each action body
  is a single `return runLedgerAction(...)` line. Revalidated paths and error handling are byte-for-byte
  behavior-identical to before: the generic actions revalidate `/accounting/ledgers` (+ the edit path on
  update); the expense-head actions revalidate `/accounting/expense-heads` and `/accounting/ledgers`
  (+ their edit path on update), exactly as previously.

## Finding 2 — merge the components' optional props into one shared config object — VERIFIED, SKIPPED

**Claim:** `LedgerTable`'s `editBasePath`/`entityLabel`/`activateAction`/`deactivateAction`,
`LedgerForm`'s `listPath`/`entityLabel`/`groupHelperText`, and `LedgerEditForm`'s
`action`/`listPath`/`entityLabel` should move into one shared entity/config object type used by all
three components.

**Verified:** the props exist exactly as described. **Skipped**, for three reasons:

1. **The prop sets are almost disjoint.** Across the three components only `entityLabel` is shared;
   every other field is component-specific (`groupHelperText` only makes sense on the create form,
   `activateAction`/`deactivateAction` only on the table, `action` only on the edit form). One shared
   type would either be a superset carrying mostly-irrelevant optional fields — letting a consumer pass
   `activateAction` to the create form and have it silently ignored, a strictly worse API than today's,
   where such a mistake is a compile error — or three per-component subsets, which is just today's
   props renamed into a nested object.
2. **Flat optional props with per-prop defaults are this codebase's established reuse convention** —
   `CompanyTable`'s `canEdit`/`canManageStatus`/`editBasePath` (see fix3 in
   `09-platform-company-split-review-fixes.md`), `CompanyForm`'s `basePath`/`redirectPath`,
   `LedgerTable`'s own pre-existing `canEdit`/`canManage`. Introducing a config-object pattern for
   just these three components would add a second, inconsistent convention rather than fix a defect —
   the same "a one-off change here would introduce inconsistency" reasoning used to skip the Zod
   `message`-vs-`error` finding in `11-review-batch-fixes-round2.md`.
3. **No third consumer exists to justify the abstraction yet** (YAGNI). Feature-spec 17 (Income Heads)
   will pass the same handful of props the Expense Heads pages do; if a real config-shape need emerges
   when it lands, that is the moment to consolidate — with an actual second data point on which fields
   genuinely co-vary.

## Validation

After the fix: `npx tsc --noEmit` clean, `npx eslint src prisma` clean, `npx vitest run` 20/20
passing, `next build` succeeds (all three `/accounting/expense-heads` routes still in the route table).
