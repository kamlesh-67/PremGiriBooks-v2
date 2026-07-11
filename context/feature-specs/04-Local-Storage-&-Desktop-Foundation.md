# 04 - Local Storage & Desktop Foundation

## Goal

Prepare the desktop environment for **Premgiri Books ERP**.

This task establishes all desktop-specific infrastructure required before implementing the database or ERP modules.

No business functionality should be implemented.

---

# Project Context

The application follows an **Offline-First Desktop Architecture**.

Desktop-specific settings should be stored locally and remain independent of the business database.

This infrastructure will later support

- Company Selection
- Theme
- Printer Settings
- Backup Location
- Window State
- Application Preferences

---

# Local Storage Service

Create

```text
src/lib/local-storage.ts
```

Implement a reusable storage service.

Responsibilities

- Save values
- Read values
- Remove values
- Clear values

The implementation should be replaceable in the future without changing application code.

Do not use browser `localStorage` directly throughout the application.

---

# Application Settings

Create

```text
src/config/app-settings.ts
```

Define the application's default settings.

Examples

- Theme
- Language
- Currency
- Date Format
- Time Format
- Auto Backup Enabled
- Backup Interval

Do not implement settings UI.

---

# Desktop Configuration

Create

```text
src/types/settings.ts
```

Define strongly typed interfaces for

- Application Settings
- Theme Settings
- Window Settings

Use strict TypeScript.

---

# Window State

Prepare support for storing

- Width
- Height
- Position
- Maximized State

Do not implement persistence yet.

Only define the interfaces and service structure.

---

# Theme Persistence

Integrate the Theme Provider with the local storage service.

Requirements

- Remember selected theme.
- Restore theme on startup.
- Default to Dark Mode.

---

# Future Storage Keys

Centralize all storage keys.

Create

```text
src/constants/storage-keys.ts
```

Examples

```text
APP_THEME

WINDOW_STATE

LAST_COMPANY

LAST_BRANCH

LAST_FINANCIAL_YEAR

BACKUP_LOCATION
```

Do not hardcode keys anywhere else.

---

# File Organization

Create

```text
src/

config/

constants/

lib/
    local-storage.ts

types/
    settings.ts
```

---

# Code Standards

Follow

- architecture-context.md
- code-standards.md

Requirements

- Strict TypeScript
- No any
- Reusable services
- No duplicated logic

---

# Do Not

Do not

- Create Prisma models
- Create ERP settings
- Create Company Settings
- Create Database Configuration
- Create APIs
- Create UI Pages
- Create Business Modules

This task prepares only the desktop infrastructure.

---

# Success Criteria

Verify

- Local storage service exists.
- Storage keys are centralized.
- Theme persistence works.
- Application settings are typed.
- Window state interfaces exist.
- No TypeScript errors.
- No ESLint errors.

After completion, the project should be ready for **05-prisma-setup.md**.
