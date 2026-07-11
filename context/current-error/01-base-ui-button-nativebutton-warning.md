# 01 - Base UI Button "nativeButton" Console Warning

## Status

Analyzed and resolved (2026-07-11).

---

## Raw Error

```
Console Error

Base UI: A component that acts as a button expected a native <button> because the
`nativeButton` prop is true. Rendering a non-<button> removes native button semantics,
which can impact forms and accessibility. Use a real <button> in the `render` prop, or
set `nativeButton` to `false`.
    at Button (src\components\ui\button.tsx:50:5)
    at CompanySelectPage (src\app\company\select\page.tsx:17:9)
```

## What The Error Is

`src/components/ui/button.tsx` wraps Base UI's `@base-ui/react/button` primitive. That primitive
defaults `nativeButton` to `true`, meaning it assumes whatever it renders is a real `<button>`
element (native keyboard activation, implicit `type="submit"` inside forms, disabled-state
semantics, screen-reader "button" role, etc. all come from the browser for free on a real
`<button>`). Base UI runs a dev-only check: if `nativeButton` is `true` but the element actually
rendered isn't a `<button>`, it logs this console warning, because those native semantics silently
stop being guaranteed.

The Company module uses Base UI's `render` prop to compose `Button`'s styling with a Next.js
`<Link>` for in-app navigation, e.g.:

```tsx
<Button render={<Link href="/company/new">Create Company</Link>} />
```

`Link` renders an `<a>` tag, not a `<button>` — so the `nativeButton: true` default no longer
matches reality, and every one of these navigation-styled-as-a-button usages logs the warning.
This is a dev-console warning, not a functional bug: the links still navigate correctly. But it's
the correct/intended Base UI signal that the component should explicitly declare it's not a native
button, since an `<a>` has different keyboard and forms semantics than a `<button>` (e.g. no
`disabled` attribute, no implicit `type="submit"`).

Found 4 occurrences of the same pattern, all under the Company module built in this session:

- `src/app/company/select/page.tsx:17` — "Create Company" (empty state)
- `src/app/company/page.tsx:41-46` — "New Company"
- `src/modules/company/components/company-table.tsx:49` — "Create Company" (empty state)
- `src/modules/company/components/company-table.tsx:83-91` — edit icon link

## Solution Analyzed (options considered)

1. **Render an actual `<button>` inside/around the `Link`** (e.g. `<Link href="..."><button>...</button></Link>`) — works, but produces invalid HTML (`<a><button>` nesting) and fights the Base UI styling/composition model the rest of the codebase already uses via `render`.
2. **Pass `nativeButton={false}` on every `Button` composed with a `Link`** — tells Base UI explicitly "this is not a native button, don't assume native semantics," which matches reality (it's a styled navigation link). Confirmed `nativeButton` is a documented, typed prop on the underlying primitive (`@base-ui/react`'s `internals/types.d.ts`). — **Chosen.**
3. **Stop using `Button` for navigation entirely and style `Link` directly with `buttonVariants(...)` classes** — also valid and arguably more idiomatic for pure navigation, but a much larger refactor across every "styled as a button" link in the module for a one-line fix; not proportionate to this warning.

Option 2 is the minimal, correct fix Base UI's own message points at ("...or set `nativeButton` to `false`"), and doesn't touch the shared `Button` component itself (per this project's rule to never modify generated shadcn/ui components — only the call sites that compose it with a non-button element need the extra prop).

## Solution Applied

Added `nativeButton={false}` to all 4 `Button` usages that compose with a `Link` via `render`:

- `src/app/company/select/page.tsx`
- `src/app/company/page.tsx`
- `src/modules/company/components/company-table.tsx` (both occurrences)

No other files needed the prop — every other `Button` in the codebase either renders as a plain
`<button>` (the default, correct case) or is itself the `render` target of something else (e.g.
`DropdownMenuTrigger render={<Button ...>}` in `theme-toggle.tsx`, where `Button` **is** a native
`<button>`, so no warning applies there).

Verified: `tsc --noEmit` and `pnpm lint` stayed clean, and a live `next dev` request to
`/company/select` no longer logs the Base UI console warning.
