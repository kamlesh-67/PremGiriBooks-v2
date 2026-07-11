# 05 - Prisma Setup

## Goal

Configure Prisma as the ORM for **Premgiri Books ERP**.

This task establishes the database infrastructure only.

Do **not** create ERP business models.

Do **not** implement business logic.

---

# Project Context

The application follows an **Offline-First Architecture**.

SQLite is the default database for the MVP.

Prisma will act as the single database access layer.

Every future module must access the database through Prisma.

---

# Install Dependencies

Install the latest compatible versions of:

* prisma
* @prisma/client

Do not install additional database libraries.

---

# Initialize Prisma

Initialize Prisma in the project.

Requirements

* Create the `prisma/` directory.
* Create `schema.prisma`.
* Configure SQLite as the datasource.
* Generate Prisma Client.

Do not create migrations yet.

---

# Database Configuration

Configure SQLite.

Database file

```text
prisma/premgiri.db
```

Datasource

```text
provider = "sqlite"
```

Keep the configuration simple.

Future database providers may be added later.

---

# Environment

Create or update

```text
.env
```

Use

```text
DATABASE_URL="file:./prisma/premgiri.db"
```

Do not introduce additional environment variables.

---

# Prisma Client

Create

```text
src/lib/prisma.ts
```

Requirements

* Export a singleton Prisma Client.
* Prevent multiple Prisma instances during development.
* Follow Prisma best practices.
* Use strict TypeScript.

All future database operations must import this client.

---

# Folder Structure

Create

```text
prisma/

schema.prisma

src/

lib/

prisma.ts
```

Do not create repositories yet.

---

# Schema

Only configure

* Generator
* Datasource

Do not create

* Company
* Customer
* Product
* Voucher
* Ledger
* Inventory
* User

No business entities should exist after this task.

---

# Database Strategy

Prisma is the only supported ORM.

Future modules must never

* Execute raw SQL unless absolutely necessary.
* Create additional database clients.
* Access SQLite directly.

All database communication must pass through Prisma.

---

# Code Standards

Follow

* architecture-context.md
* code-standards.md

Requirements

* Strict TypeScript
* No any
* Singleton Prisma Client
* Clean folder structure

---

# Do Not

Do not

* Create Models
* Create Migrations
* Seed Data
* Create APIs
* Create Repositories
* Create Services
* Create Business Logic
* Create Authentication Tables

This task prepares the database infrastructure only.

---

# Success Criteria

Verify

* Prisma initializes successfully.
* SQLite datasource is configured.
* Prisma Client is generated.
* `src/lib/prisma.ts` exports a singleton instance.
* The project builds without errors.
* No TypeScript errors.
* No ESLint errors.

After completion, the project should be ready for **06-database-foundation.md**.
