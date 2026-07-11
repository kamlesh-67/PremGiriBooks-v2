# UI Context

## Theme

Premgiri Books ERP supports both **Light** and **Dark** themes.

The interface is designed for long working hours in accounting, billing, inventory, and GST operations.

The design language focuses on:

- High readability
- Low eye fatigue
- Fast keyboard operation
- Clear data hierarchy
- Professional ERP appearance

All colors are defined as CSS custom properties in `globals.css` and mapped to Tailwind using `@theme inline`.

Components must never use hardcoded colors.

---

# Color System

## Dark Theme

| Role | CSS Variable | Value |
|------|--------------|-------|
| Background | `--bg-base` | `#080809` |
| Surface | `--bg-surface` | `#111114` |
| Elevated Surface | `--bg-elevated` | `#18181C` |
| Subtle Surface | `--bg-subtle` | `#1E1E23` |
| Border | `--border-default` | `#2A2A30` |
| Border Light | `--border-subtle` | `#3A3A42` |
| Primary Text | `--text-primary` | `#F0F0F4` |
| Secondary Text | `--text-secondary` | `#C0C0CC` |
| Muted Text | `--text-muted` | `#808090` |
| Brand | `--accent-primary` | `#00C8D4` |
| Brand Background | `--accent-primary-dim` | `rgba(0,200,212,.12)` |
| AI Accent | `--accent-ai` | `#6457F9` |
| AI Text | `--accent-ai-text` | `#8B82FF` |
| Success | `--state-success` | `#34D399` |
| Warning | `--state-warning` | `#FBBF24` |
| Error | `--state-error` | `#FF4D4F` |

---

## Light Theme

| Role | CSS Variable | Value |
|------|--------------|-------|
| Background | `--bg-base` | `#F8FAFC` |
| Surface | `--bg-surface` | `#FFFFFF` |
| Elevated Surface | `--bg-elevated` | `#F1F5F9` |
| Subtle Surface | `--bg-subtle` | `#E2E8F0` |
| Border | `--border-default` | `#CBD5E1` |
| Border Light | `--border-subtle` | `#E2E8F0` |
| Primary Text | `--text-primary` | `#0F172A` |
| Secondary Text | `--text-secondary` | `#334155` |
| Muted Text | `--text-muted` | `#64748B` |
| Brand | `--accent-primary` | `#0891B2` |
| Brand Background | `--accent-primary-dim` | `rgba(8,145,178,.10)` |
| AI Accent | `--accent-ai` | `#6457F9` |
| AI Text | `--accent-ai-text` | `#4F46E5` |
| Success | `--state-success` | `#16A34A` |
| Warning | `--state-warning` | `#D97706` |
| Error | `--state-error` | `#DC2626` |

---

# Semantic Colors

Never use colors directly.

Always use semantic variables.

Examples

Success

- Payment Received
- Stock Available
- Completed

Warning

- Low Stock
- Credit Limit Near
- Pending GST

Error

- Validation Error
- Negative Stock
- Failed Payment

Brand

- Primary Buttons
- Active Navigation
- Selected Rows
- Links

AI

- AI Assistant
- AI Suggestions
- AI Generated Content

---

# Typography

| Role | Font |
|------|------|
| UI | Geist Sans |
| Numbers | Geist Mono |
| Reports | Geist Sans |

Rules

- Use tabular numbers where possible.
- Monetary values should use monospaced digits.
- Right-align all numeric columns.
- Left-align text columns.

---

# Border Radius

| Component | Radius |
|-----------|---------|
| Input | rounded-lg |
| Button | rounded-lg |
| Card | rounded-xl |
| Dialog | rounded-2xl |
| Page Panels | rounded-2xl |

ERP applications should prefer subtle rounded corners over overly rounded designs.

---

# Shadows

| Level | Usage |
|---------|-------|
| None | Tables |
| Small | Cards |
| Medium | Dialogs |
| Large | Floating Panels |

Avoid heavy shadows.

---

# Icons

Library

Lucide React

Sizes

| Usage | Size |
|---------|------|
| Table | 16px |
| Button | 18px |
| Toolbar | 20px |
| Dashboard | 24px |
| Empty State | 40px |

Always use outline icons.

---

# Layout

## Application

```
┌─────────────────────────────┐
│ Navbar                      │
├──────────────┬──────────────┤
│ Sidebar      │ Content       │
│              │               │
│              │               │
└──────────────┴──────────────┘
```

---

## Navigation

Left Sidebar

Contains

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

Top Navbar

Contains

- Company
- Branch
- Financial Year
- Global Search
- Notifications
- User Menu

---

# Dashboard

Widgets

- Sales Today
- Purchase Today
- Cash Balance
- Bank Balance
- Receivable
- Payable
- GST Summary
- Low Stock
- Monthly Sales
- Monthly Profit

Dashboard should prioritize important financial information.

---

# Forms

Rules

- Labels always above fields.
- Required fields show "*".
- Validation below input.
- Keyboard-first navigation.
- Enter moves to next field.
- Escape closes dialogs.

---

# Tables

Tables are the most frequently used UI.

Requirements

- Sticky Header
- Sticky Actions
- Zebra Rows (optional)
- Keyboard Navigation
- Sorting
- Filtering
- Pagination
- Column Resize (Future)
- Export

Numeric columns

Right aligned.

Text

Left aligned.

---

# Billing Screen

The billing screen is the most performance-critical screen.

Requirements

- Keyboard-first workflow.
- Fast product search.
- Fast customer search.
- Minimal mouse interaction.
- Live totals.
- GST summary.
- Payment summary.
- Invoice shortcuts.

---

# Search Experience

Global Search supports

- Products
- Customers
- Suppliers
- Invoice Numbers
- Part Numbers
- HSN Codes

Future

- OCR
- Voice Search

---

# Dialogs

Dialog types

- Create
- Edit
- Delete
- Confirmation
- Preview
- Print

Dialogs should never exceed 80% viewport width.

---

# Buttons

Primary

Brand color

Secondary

Surface color

Danger

Error color

Ghost

Transparent

Disabled

Muted colors

---

# Status Colors

Draft

Gray

Saved

Blue

Posted

Green

Cancelled

Red

Pending

Orange

---

# Accessibility

- WCAG AA contrast.
- Keyboard accessible.
- Visible focus ring.
- Screen-reader friendly labels.
- Minimum touch target 44px.

---

# Responsive Behavior

Desktop

Primary target.

Tablet

Supported.

Mobile

Read-only reports and basic operations.

Full billing workflow is desktop optimized.

---

# Printing

Reports

A4 Portrait

Invoices

A5 / A4

Thermal

Future support

All printed documents should have print-specific styles.

---

# Component Library

Use

- shadcn/ui

Never modify generated components.

Extend them through wrappers.

---

# Design Principles

1. Business first.
2. Speed over decoration.
3. High information density.
4. Consistent spacing.
5. Keyboard-first interaction.
6. Accessible by default.
7. No hardcoded colors.
8. Reusable components only.
9. Offline-first experience.
10. Professional ERP appearance.