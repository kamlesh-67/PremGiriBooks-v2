# 06 - User Menu's DropdownMenuLabel Missing Required Menu.Group Ancestor

## Status

Analyzed and resolved (2026-07-12).

---

## Raw Error

```text
Runtime Error

Base UI: MenuGroupContext is missing. Menu group parts must be used within <Menu.Group> or <Menu.RadioGroup>.


    at DropdownMenuLabel (src/components/ui/dropdown-menu.tsx:64:5)
    at UserListPage (src\app\settings\users\page.tsx:29:5)
```

## What The Error Is

`src/components/ui/dropdown-menu.tsx`'s `DropdownMenuLabel` wraps Base UI's `Menu.GroupLabel` primitive directly:

```tsx
function DropdownMenuLabel({ className, inset, ...props }: MenuPrimitive.GroupLabel.Props & { inset?: boolean }) {
  return (
    <MenuPrimitive.GroupLabel
      data-slot="dropdown-menu-label"
      data-inset={inset}
      className={cn("px-1.5 py-1 text-xs font-medium text-muted-foreground data-inset:pl-7", className)}
      {...props}
    />
  )
}
```

Confirmed via `node_modules/@base-ui/react/menu/group-label/MenuGroupLabel.js` and `node_modules/@base-ui/react/menu/group/MenuGroupContext.js`: `Menu.GroupLabel` unconditionally calls `useMenuGroupRootContext()` on every render, which **throws** (not warns) if there is no ancestor `Menu.Group`/`Menu.RadioGroup` providing that context — there's no "ungrouped" fallback mode. This is a hard runtime requirement of the primitive, not something introduced by this project's wrapper.

`src/components/layout/top-navbar.tsx` (feature-spec 07, Authentication) uses `DropdownMenuLabel` for the User menu's name/role header, but places it directly inside `DropdownMenuContent` with no `DropdownMenuGroup` wrapper:

```tsx
<DropdownMenuContent align="end">
  {user && (
    <>
      <DropdownMenuLabel className="flex flex-col gap-0.5">
        <span className="text-sm font-medium">{user.fullName}</span>
        <span className="text-xs font-normal text-muted-foreground">{user.role}</span>
      </DropdownMenuLabel>
      <DropdownMenuSeparator />
    </>
  )}
  <DropdownMenuItem onClick={() => void handleLogout()}>
    <LogOut size={16} />
    Logout
  </DropdownMenuItem>
</DropdownMenuContent>
```

`TopNavbar` is part of `AppShell`, rendered on every authenticated page (Dashboard, Company, Financial Year, and now Settings → Users from feature-spec 10). Base UI's Menu popup content only mounts once the menu is actually opened, so this crash fires the moment a signed-in user clicks the User menu icon in the top navbar — on any page, not something specific to `/settings/users`. It happened to surface here (stack trace shows `UserListPage`) simply because that's the page open when the menu was clicked; the defect itself predates feature-spec 10 and was introduced when the User menu was first wired up in feature-spec 07.

## Solution Analyzed (options considered)

1. **Do nothing / stop using `DropdownMenuLabel` for this header** (e.g. a plain styled `<div>` instead) — avoids the primitive entirely, but throws away the shadcn-generated component's semantics (Base UI still marks the label `role="presentation"` and associates an `id` for accessibility) for no reason other than working around a real, fixable requirement.
2. **Wrap the existing `DropdownMenuLabel` in a `DropdownMenuGroup`** — `src/components/ui/dropdown-menu.tsx` already exports `DropdownMenuGroup` (a thin wrapper over `Menu.Group`, unused anywhere in the codebase before this fix), which is exactly the ancestor `Menu.GroupLabel` requires. Matches the shadcn/ui reference pattern for this component (a `DropdownMenuLabel` is conventionally paired with a `DropdownMenuGroup` when grouping is semantically meaningful, which it is here — the name/role block is a distinct informational group above the action items). **Chosen.**

Option 2 is the minimal, correct fix pointed at directly by the error's own wording ("must be used within `<Menu.Group>`"), and doesn't touch the generated `src/components/ui/dropdown-menu.tsx` wrapper (per this project's rule to never modify generated shadcn/ui components) — only the call site in `top-navbar.tsx` needed to change.

## Solution Applied

`src/components/layout/top-navbar.tsx`:

- Imported `DropdownMenuGroup` alongside the other `dropdown-menu` exports already in use.
- Wrapped the name/role `DropdownMenuLabel` in a `DropdownMenuGroup`:

```tsx
{user && (
  <>
    <DropdownMenuGroup>
      <DropdownMenuLabel className="flex flex-col gap-0.5">
        <span className="text-sm font-medium">{user.fullName}</span>
        <span className="text-xs font-normal text-muted-foreground">{user.role}</span>
      </DropdownMenuLabel>
    </DropdownMenuGroup>
    <DropdownMenuSeparator />
  </>
)}
```

`DropdownMenuSeparator` and the `DropdownMenuItem` below it stay outside the group — they aren't part of the labeled group, matching the shadcn/ui reference layout (a group label only labels the group's own items, not sibling content after the group closes).

**Verified:**

- `tsc --noEmit` and `pnpm lint` stayed clean.
- No other call site in the codebase uses `DropdownMenuLabel` (grepped `src/`) — this was the only occurrence, so no other page shares this defect.
