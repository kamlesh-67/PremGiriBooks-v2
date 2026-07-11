# 03 - Application Shell

## Goal

Build the reusable desktop application shell for **Premgiri Books ERP**.

This shell becomes the layout used by every authenticated page.

Do **not** implement any business functionality.

No ERP modules should be created.

---

# Project Context

Follow

- architecture-context.md
- ui-context.md
- code-standards.md

The application is an **Offline-First Desktop ERP**.

The shell must prioritize:

- Keyboard navigation
- Information density
- Large work area
- Fast navigation

---

# Create Layout

Create the reusable ERP application layout.

The layout consists of

```text
┌────────────────────────────────────────────────────────────┐
│ Top Navigation Bar                                         │
├──────────────┬─────────────────────────────────────────────┤
│ Sidebar      │                                             │
│              │                                             │
│              │           Main Content Area                 │
│              │                                             │
│              │                                             │
├──────────────┴─────────────────────────────────────────────┤
│ Status Bar                                                 │
└────────────────────────────────────────────────────────────┘
```

The layout should occupy the full viewport.

---

# Top Navigation

Create

```text
src/components/layout/top-navbar.tsx
```

Requirements

Left

- Application Logo
- Application Name

Center

- Global Search Placeholder

Right

- Theme Toggle
- Notifications Placeholder
- User Menu Placeholder

Use semantic color tokens only.

---

# Sidebar

Create

```text
src/components/layout/sidebar.tsx
```

Requirements

Collapsible

Desktop optimized

Scrollable

Keyboard accessible

Collapsed width

- Icons only

Expanded width

- Icons
- Labels

---

# Sidebar Navigation

Create placeholder navigation items.

- Dashboard
- Masters
- Sales
- Purchase
- Inventory
- Accounting
- GST
- Reports
- Employees
- Settings

Each item

- Icon
- Label

Do not implement navigation yet.

---

# Status Bar

Create

```text
src/components/layout/status-bar.tsx
```

Display placeholders for

- Company
- Financial Year
- Branch
- Database Status
- Theme

No real data.

---

# Main Content

Create

```text
src/components/layout/content.tsx
```

Requirements

- Responsive
- Scrollable
- Fill remaining viewport
- Support nested layouts

---

# Global Search

Add a placeholder search component.

Do not implement search logic.

Placeholder

```text
Search products, customers, invoices...
```

---

# Theme Toggle

Use

next-themes

Requirements

- Dark
- Light
- System

Use Lucide icons.

---

# Responsive Behavior

Desktop

Primary target.

Tablet

Supported.

Mobile

Basic support only.

The billing workflow is desktop-first.

---

# Component Structure

Create

```text
src/components/layout/

app-shell.tsx

top-navbar.tsx

sidebar.tsx

sidebar-item.tsx

content.tsx

status-bar.tsx
```

Components must remain reusable.

---

# Styling

Follow

ui-context.md

Requirements

- Semantic colors only
- No hardcoded colors
- Consistent spacing
- Sticky navbar
- Sticky sidebar
- Sticky status bar

---

# Accessibility

Support

- Keyboard navigation
- Focus visibility
- Screen readers
- Proper landmarks

---

# Do Not

Do not

- Create Dashboard
- Create Authentication
- Create Company Selector
- Create Notifications
- Create User Profile
- Create Search Logic
- Create Routing
- Create Business Modules
- Create API Calls

Only create the reusable shell.

---

# Success Criteria

Verify

- Full viewport layout renders.
- Sidebar collapses correctly.
- Navbar remains fixed.
- Status bar remains fixed.
- Theme switching works.
- Components are reusable.
- No TypeScript errors.
- No ESLint errors.

After completion, the project should be ready for **04-Local-Storage & Desktop-Foundation**.
