# 05 - Prisma Setup

## Goal

Configure Prisma as the ORM for **Premgiri Books ERP**.

This task establishes the database infrastructure only.

Do **not** create ERP business models.

Do **not** implement business logic.

---

# Project Context

The application follows an **Offline-First Architecture**.

PostgreSQL (Local) is the primary database, per `architecture-context.md` and `code-standards.md`. It runs locally on the same machine or office network — no external/cloud database connection is required for core business operations.

Prisma will act as the single database access layer.

Every future module must access the database through Prisma.

---

# Install Dependencies

Install the latest compatible versions of:

* prisma
* @prisma/client
* @prisma/adapter-pg
* pg

Prisma 7 requires a driver adapter to connect to PostgreSQL; `@prisma/adapter-pg` (backed by `pg`) is required for this, not optional.

Do not install additional database libraries.

---

# Initialize Prisma

Initialize Prisma in the project.

Requirements

* Create the `prisma/` directory.
* Create `schema.prisma`.
* Configure PostgreSQL as the datasource.
* Generate Prisma Client.

Do not create migrations yet.

---

# Database Configuration

Configure PostgreSQL.

Datasource

```text
provider = "postgresql"
```

Keep the configuration simple.

---

# Environment

Create or update

```text
.env
```

Use

```text
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/premgiri_books?schema=public"
```

A local PostgreSQL server must be running and reachable at this connection string. Adjust user/password/port to match the local instance; do not introduce additional environment variables.

---

# Prisma Client

Create

```text
src/lib/prisma.ts
```

Requirements

* Export a singleton Prisma Client.
* Construct the client with the `@prisma/adapter-pg` driver adapter (required by Prisma 7 for PostgreSQL).
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
* Access PostgreSQL directly.

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
* PostgreSQL datasource is configured.
* Prisma Client is generated.
* `src/lib/prisma.ts` exports a singleton instance.
* The project builds without errors.
* No TypeScript errors.
* No ESLint errors.

After completion, the project should be ready for **06-database-foundation.md**.
