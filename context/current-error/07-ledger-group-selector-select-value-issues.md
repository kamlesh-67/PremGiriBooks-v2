# 07 - LedgerGroupSelector: Uncontrolled-to-Controlled Warning + Raw Id Shown Instead of Group Name

## Status

Analyzed and resolved (2026-07-13).

---

## Raw Error

```text
Console Error

Base UI: A component is changing the uncontrolled value state of Select to be controlled.
Elements should not switch from uncontrolled to controlled (or vice versa).
Decide between using a controlled or uncontrolled Select element for the lifetime of the component.
The nature of the state is determined during the first render. It's considered controlled if the value is not `undefined`.
More info: https://fb.me/react-controlled-components


    at LedgerGroupSelector (src/modules/ledger-groups/components/ledger-group-selector.tsx:39:5)
    at Object.render (src/modules/ledgers/components/ledger-form.tsx:91:15)
    at FormField (src/components/ui/form.tsx:36:7)
    at LedgerForm (src/modules/ledgers/components/ledger-form.tsx:85:9)
    at NewLedgerPage (src\app\accounting\ledgers\new\page.tsx:32:9)
```

A second, related defect was reported alongside it: selecting a Ledger Group on `/accounting/ledgers/new` displayed the group's raw uuid in the closed trigger instead of its name.

## What The Errors Are

### 1. Uncontrolled → controlled warning

`src/modules/ledger-groups/components/ledger-group-selector.tsx` (feature-spec 13, reused by feature-spec 14's `LedgerForm` for the required Ledger Group field) had:

```tsx
<Select
  value={value ?? (allowNone ? NONE_VALUE : undefined)}
  ...
>
```

`LedgerForm` (`src/modules/ledgers/components/ledger-form.tsx`) calls this with `allowNone={false}` and `value={field.value || undefined}`, where `field.value` (react-hook-form's `ledgerGroupId`) starts as `""`. On the **first render**: `value` is `undefined`, `allowNone` is `false`, so `value ?? (allowNone ? NONE_VALUE : undefined)` evaluates to `undefined` — Base UI's `Select.Root` decides it's **uncontrolled** right there, exactly as documented ("considered controlled if the value is not `undefined`"). The moment a group is picked, the prop becomes a real uuid string, and Base UI logs the warning for switching from uncontrolled to controlled mid-lifetime.

This is the exact same defect class as `context/current-error/05-role-select-uncontrolled-to-controlled.md` (`RoleSelect`), just in a different component — `allowNone={true}` call sites (e.g. `LedgerGroupForm`'s own Parent Group field) never hit this, since `NONE_VALUE` is always a defined string from the first render on; only the newly-added `allowNone={false}` usage in `LedgerForm` exposed it.

### 2. Closed trigger shows the raw group id, not its name

`SelectValue` (Base UI's `Select.Value`) resolves what to display via `resolveSelectedLabel(value, items, itemToStringLabel)` (`node_modules/@base-ui/react/internals/resolveValueLabel.js`). `items`/`itemToStringLabel` are `Select.Root` props this codebase's `src/components/ui/select.tsx` wrapper never sets, and are not automatically derived from mounted `Select.Item` children — so with no matching `items` entry, `resolveSelectedLabel` falls through to `stringifyAsLabel(value, undefined)`, which for a plain string `value` (the group's uuid, not an object with a `.label`) returns the raw value itself via `serializeValue`.

Base UI's docs confirm this is expected when a `Select.Item`'s visual content is arbitrary JSX rather than plain text: `LedgerGroupSelector`'s items render `<span>{group.name}<AccountNatureBadge .../></span>`, which `Select.Value` cannot synchronously reduce to a label string on its own — the primitive expects either an `items`/`itemToStringLabel` prop on `Select.Root`, or a `children` render-function passed to `Select.Value` itself (`node_modules/@base-ui/react/select/value/SelectValue.d.ts` documents exactly this: `children?: React.ReactNode | ((value: any) => React.ReactNode)`).

## Solution Analyzed (options considered)

**For the controlled/uncontrolled warning:**

1. **Give `ledgerGroupId` a non-empty default** so `value` is never falsy on first render. Rejected — same reasoning as `05-role-select-...md`: it would silently pre-select a real group the user never chose, contradicting the field's `required` validation intent.
2. **Pass `null` instead of `undefined` as the "nothing selected, no `allowNone`" sentinel** — confirmed via Base UI's `Select.Root` value typing that `null` is a distinct, **defined** value separate from the `undefined` that signals "uncontrolled." **Chosen** — identical fix shape to `05-role-select-...md`.

**For the raw-id display:**

1. **Pass `items`/`itemToStringLabel` to the underlying `Select.Root`** — would require changing `src/components/ui/select.tsx`'s generated wrapper to thread these through, or passing them at every call site. Rejected: touches the shared generated component (against this project's convention of only changing call sites), and duplicates data (`groups`) that `LedgerGroupSelector` already has in scope.
2. **Pass a `children` render-function to `Select.Value`, resolving the label from the `groups` prop already available in `LedgerGroupSelector`** — no shared component changes, no duplicated data, and it's the pattern Base UI's own type declarations document for exactly this case. **Chosen.**

Both fixes only touch `ledger-group-selector.tsx` (the call site) — `src/components/ui/select.tsx` is untouched, per this project's rule to never modify generated shadcn/ui components.

## Solution Applied

`src/modules/ledger-groups/components/ledger-group-selector.tsx`:

```tsx
<Select
  value={value ?? (allowNone ? NONE_VALUE : null)}
  onValueChange={(next) => onChange(!next || next === NONE_VALUE ? undefined : next)}
  disabled={disabled}
>
  <SelectTrigger className="w-full">
    <SelectValue placeholder={placeholder}>
      {(current: string | null) => {
        if (!current || current === NONE_VALUE) {
          return allowNone ? "No parent (top-level group)" : placeholder;
        }
        const selected = groups.find((group) => group.id === current);
        if (!selected) {
          return placeholder;
        }
        return (
          <span className="flex flex-1 items-center justify-between gap-2">
            <span>{selected.name}</span>
            <AccountNatureBadge nature={selected.natureType} />
          </span>
        );
      }}
    </SelectValue>
  </SelectTrigger>
  ...
</Select>
```

Since this component is shared by both `13-ledger-groups.md` (`LedgerGroupForm`'s Parent Group field, `allowNone={true}`) and `14-ledger-master.md` (`LedgerForm`'s Ledger Group field, `allowNone={false}`), both fixes apply to every consumer at once.

**Verified:**

- `tsc --noEmit` and `eslint` stayed clean.
- `next build` unaffected (no route/type changes).
- The `value` prop passed to `Select.Root` is now `null`, `NONE_VALUE`, or a real group id — never `undefined` — so it is controlled from the very first render onward.
- The closed trigger now resolves the selected group's name (and nature badge) directly from the `groups` array already passed into the component, instead of relying on Base UI's `items`/`itemToStringLabel` root-level wiring (which this codebase's shared `select.tsx` wrapper never sets up).
