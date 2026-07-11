# 02 - Design System

## Goal

Set up the complete design system foundation for **Premgiri Books ERP**.

This task establishes the reusable UI foundation for the entire application.

Do **not** build any ERP screens or business modules.

Follow the design specifications defined in:

- ui-context.md
- architecture-context.md
- code-standards.md

---

# Install shadcn/ui

Install and configure the latest stable version of **shadcn/ui**.

Requirements

- Use the existing Tailwind CSS configuration.
- Configure using the App Router.
- Configure using TypeScript.
- Use the existing import alias.

Do not modify generated shadcn components after installation.

Future customization must happen through wrappers.

---

# Install Dependencies

Install

- lucide-react
- class-variance-authority
- clsx
- tailwind-merge
- next-themes

Install only if not already installed.

---

# Create Utility

Create

```text
src/lib/utils.ts
```

Implement the reusable

```ts
cn();
```

utility using

- clsx
- tailwind-merge

This utility will be used throughout the project.

---

# Configure Theme

Implement theme support using

```text
next-themes
```

Requirements

- Dark Theme
- Light Theme
- System Theme Support

Dark mode should be the default.

Theme switching should use CSS variables only.

Do not hardcode colors.

---

# Configure globals.css

Update the existing

```text
src/app/globals.css
```

Use the color system defined in

```text
ui-context.md
```

Create semantic tokens.

Dark Theme

- Background
- Surface
- Elevated
- Border
- Text
- Primary
- Success
- Warning
- Error
- AI Accent

Light Theme

- Background
- Surface
- Elevated
- Border
- Text
- Primary
- Success
- Warning
- Error
- AI Accent

Do not use Tailwind default colors for application components.

---

# Configure Tailwind Theme

Expose CSS variables through Tailwind.

Semantic tokens should include

- background
- foreground
- card
- popover
- primary
- secondary
- muted
- accent
- destructive
- border
- input
- ring

Add ERP-specific tokens

- surface
- elevated
- success
- warning
- error
- ai
- sidebar
- navbar

---

# Install shadcn Components

Install only the following components.

Core

- Button
- Card
- Input
- Label
- Form
- Dialog
- Alert Dialog
- Dropdown Menu
- Sheet
- Tabs
- Table
- Scroll Area
- Tooltip
- Select
- Popover
- Checkbox
- Switch
- Separator
- Badge
- Skeleton
- Sonner

Navigation

- Navigation Menu
- Breadcrumb

Feedback

- Progress
- Avatar

Do not install components that are not required.

---

# Typography

Configure the application to use

Primary Font

- Geist Sans

Monospace Font

- Geist Mono

Requirements

- Tabular numbers
- Optimized financial data display
- Right-aligned numeric values
- Consistent typography scale

---

# Theme Provider

Create

```text
src/components/providers/theme-provider.tsx
```

Wrap the root layout with

ThemeProvider

Requirements

- System Theme Support
- Disable transition flash
- Default Dark Theme

---

# Component Rules

Do not modify

```text
components/ui/*
```

Create reusable wrappers later inside

```text
components/common/
```

if customization is required.

---

# Icons

Use

```text
lucide-react
```

only.

Do not introduce additional icon libraries.

---

# Design Tokens

The application must use semantic variables only.

Never write

```css
text-blue-500
bg-red-500
border-gray-200
```

Instead use

```css
bg-background
text-foreground
border-border
bg-surface
text-muted-foreground
bg-primary
text-primary-foreground
```

ERP-specific tokens should also be used where appropriate.

---

# Accessibility

Configure the design system for

- WCAG AA contrast
- Visible keyboard focus
- Accessible dialogs
- Accessible forms
- Accessible tables

Accessibility should be built into the foundation.

---

# Do Not

Do not

- Create layouts
- Create navigation
- Create dashboard
- Create authentication
- Create ERP pages
- Create business components
- Create forms
- Create modules
- Create APIs

Only establish the design system.

---

# Success Criteria

Verify

- shadcn/ui is configured successfully.
- ThemeProvider is working.
- Dark theme is the default.
- Light theme is supported.
- CSS variables are used throughout.
- Tailwind semantic tokens work correctly.
- `cn()` utility works.
- All installed shadcn components compile.
- Geist fonts are configured.
- No TypeScript errors.
- No ESLint errors.

After completion, the project should be ready for **03-prisma-setup.md**.
