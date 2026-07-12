# 05 - RoleSelect Switched From Uncontrolled to Controlled Base UI Select

## Status

Analyzed and resolved (2026-07-12).

---

## Raw Error

```
Console Error

Base UI: A component is changing the uncontrolled value state of Select to be controlled.
Elements should not switch from uncontrolled to controlled (or vice versa).
Decide between using a controlled or uncontrolled Select element for the lifetime of the component.
The nature of the state is determined during the first render. It's considered controlled if the value is not `undefined`.
More info: https://fb.me/react-controlled-components


    at RoleSelect (src/modules/users/components/role-select.tsx:22:5)
    at Object.render (src/modules/users/components/user-form.tsx:153:19)
    at FormField (src/components/ui/form.tsx:36:7)
    at UserForm (src/modules/users/components/user-form.tsx:146:11)
    at UserCreateForm (src/modules/users/components/user-create-form.tsx:15:5)
    at NewUserPage (src\app\settings\users\new\page.tsx:26:9)
```

## What The Error Is

`src/modules/users/components/role-select.tsx` (feature-spec 10, User Management) wraps `@/components/ui/select`'s Base UI `Select` primitive and forwards `react-hook-form`'s `roleId` field value straight through:

```tsx
<Select
  value={value || undefined}
  onValueChange={(nextValue) => onChange(nextValue ?? "")}
  disabled={disabled}
>
```

`UserForm`'s `roleId` field starts out as `""` (see `BASE_DEFAULT_VALUES` in `user-form.tsx`, and the Create page passes no `defaultValues` override). On the **first render**, `value || undefined` evaluates `"" || undefined` → `undefined`. Base UI's `Select.Root` decides whether it's controlled or uncontrolled exactly once, on that first render, by checking whether `value` is `undefined` — so `RoleSelect` starts life as an **uncontrolled** Select.

The moment the user picks a role in the dropdown, `field.onChange` fires, `roleId` becomes a non-empty string, and `value || undefined` now evaluates to that string instead of `undefined`. Base UI sees the `value` prop go from `undefined` to a real value across renders and logs this warning — the component tried to change from uncontrolled to controlled mid-lifetime, which React (and Base UI's controlled/uncontrolled detection, modeled on React's own) explicitly warns against.

This is a dev-console warning, not a functional bug: role selection still worked correctly in manual testing. But it's the correct signal that `RoleSelect` needs to be controlled for its entire lifetime, including while no role is selected yet.

## Solution Analyzed (options considered)

1. **Keep `value={value || undefined}`, do nothing** — the warning is cosmetic and selection still functions. Rejected: it's a real, easily-triggered dev warning on every Create User page load (before a role is picked), and it signals an actual first-render/later-render inconsistency in props passed to a Base UI primitive, not just noise.
2. **Give `roleId` a non-empty default value** (e.g. pre-select the first role or "Employee") so `value` is never `""` on first render — avoids the `undefined` branch entirely. Rejected: this would silently pre-select a real role for the user without their choosing it, contradicting the Zod schema's `roleId: z.string().trim().min(1, "Role is required")` validation intent (a role should be a deliberate choice, not a default two clicks away from being submitted unnoticed) and diverging from how `CompanyForm`/`FinancialYearForm` treat required-but-unset fields (they stay genuinely empty until the user acts).
3. **Always pass a defined `value` to Base UI's `Select`, using `null` (not `undefined`) as the "nothing selected yet" sentinel** — confirmed via `node_modules/@base-ui/react/select/root/SelectRoot.d.ts` that `Select.Root`'s `value` prop type is `SelectValueType<Value, Multiple> | null | undefined`, i.e. Base UI explicitly supports `null` as a distinct, **defined** "controlled, no selection" value, separate from the `undefined` that signals "uncontrolled." Passing `null` instead of `undefined` on every render (including the first, when `roleId` is `""`) keeps the component controlled from render one onward — the value transitions from `null` to a role id string, never from `undefined` to a value. **Chosen.**

Option 3 is the minimal, correct fix — it doesn't change any business/validation behavior (an empty `roleId` still fails `roleId: z.string().trim().min(1, ...)` exactly as before) and doesn't touch the shared `src/components/ui/select.tsx` wrapper (per this project's rule to never modify generated shadcn/ui components — only the call site needed to change).

## Solution Applied

`src/modules/users/components/role-select.tsx`:

```tsx
<Select
  value={value === "" ? null : value}
  onValueChange={(nextValue) => onChange(nextValue ?? "")}
  disabled={disabled}
>
```

`onValueChange` was already correctly mapping Base UI's `null` (its own "cleared" sentinel) back to `""` for the string-based `onChange` callback `RoleSelect`'s own props expose, so no change was needed there.

**Verified:**

- `tsc --noEmit` and `pnpm lint` stayed clean.
- `next build` unaffected (no route/type changes).
- Confirmed via the Base UI type declarations that `null` is a documented, defined value distinct from `undefined` for `Select.Root`'s `value` prop, so the component is controlled (value is never `undefined`) from the very first render through every subsequent one — the exact condition the warning's own wording calls for ("It's considered controlled if the value is not `undefined`").
