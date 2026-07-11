# 00 - Project Setup (Electron + Next.js)

## Goal

Initialize the **Premgiri Books ERP** project using the architecture defined in:

* PRD.md
* project-overview.md
* architecture-context.md
* code-standards.md
* ui-context.md
* ai-workflow-rules.md

This task creates the project foundation only.

Do **not** implement any ERP modules.

---

# Architecture

Create an **Offline-First Desktop ERP** using:

* Electron
* Next.js 16 (App Router)
* React
* TypeScript
* Tailwind CSS
* Prisma
* SQLite (Default Database)

Electron should only provide the desktop shell.

All business logic must remain inside the Next.js application.

---

# Create Project

Initialize a new Next.js application.

Requirements

* TypeScript
* App Router
* Tailwind CSS
* ESLint
* Turbopack
* src directory
* Import Alias `@/*`

Do not use any project starter templates other than the official Next.js starter.

---

# Install Dependencies

Install the latest stable versions compatible with Next.js 16.

## Desktop

* electron
* electron-builder
* concurrently
* wait-on
* cross-env

## Database

* prisma
* @prisma/client

## Validation

* zod

## State

* zustand
* @tanstack/react-query

## Forms

* react-hook-form

## Utilities

* clsx
* class-variance-authority
* tailwind-merge
* date-fns

## Icons

* lucide-react

## Notifications

* sonner

## Theme

* next-themes

---

# Folder Structure

Create the following structure.

```text
docs/

electron/
    main.ts
    preload.ts

prisma/

src/

    app/

    components/
        ui/
        common/
        layout/

    modules/

    engines/

    database/

    lib/

    hooks/

    types/

    utils/

    config/

    constants/

    styles/
```

Do not create unnecessary folders.

---

# Electron

Create

```
electron/main.ts
```

Requirements

* Create BrowserWindow
* Auto-hide menu bar
* Context Isolation enabled
* Node Integration disabled
* Secure preload
* Development loads

```
http://localhost:3000
```

Production should be structured for loading the packaged application later.

Do not implement auto-updates.

Do not implement IPC handlers yet.

---

Create

```
electron/preload.ts
```

Expose an empty secure API using Context Bridge.

No business functionality.

---

# TypeScript

Create

```
tsconfig.electron.json
```

Compile Electron separately from Next.js.

Output

```
dist-electron/
```

---

# Package Scripts

Configure scripts for:

Development

* next dev
* electron
* concurrent development

Build

* next build
* electron compilation

Prepare the project so Electron launches automatically after the Next.js development server is ready.

---

# Prisma

Initialize Prisma.

Configure SQLite as the default datasource.

Database file

```
prisma/premgiri.db
```

Do not create any models.

Do not run migrations.

---

# Environment

Create

```
.env.example
```

Include

```
DATABASE_URL="file:./prisma/premgiri.db"

APP_NAME="Premgiri Books ERP"

APP_VERSION="1.0.0"

NODE_ENV="development"
```

Do not create production secrets.

---

# Business Rules

Do not create

* Customers
* Products
* Inventory
* Accounting
* GST
* Reports

No ERP functionality should exist after this task.

This task is infrastructure only.

---

# Security

Electron must use

* contextIsolation = true
* nodeIntegration = false
* preload script
* autoHideMenuBar = true

Never expose Node APIs directly to the renderer.

---

# Code Quality

Follow

* architecture-context.md
* code-standards.md

Use strict TypeScript.

No `any`.

No unused files.

No placeholder business code.

---

# Do Not

Do not install authentication.

Do not install shadcn/ui.

Do not create layouts.

Do not create modules.

Do not create Prisma models.

Do not create APIs.

Do not create sample pages.

Do not modify the default Next.js page beyond what is required to verify the application starts successfully.

---

# Success Criteria

Verify

* Next.js starts successfully.
* Electron launches the application.
* Electron opens the Next.js application.
* Hot reload works.
* TypeScript builds successfully.
* Prisma is initialized.
* SQLite configuration exists.
* Folder structure matches the specification.
* No TypeScript errors.
* No ESLint errors.

After completion, the project should be ready for **01 - Design System**.
