# 00 - Prisma ECONNREFUSED on Company Queries

## Status

Analyzed and resolved (2026-07-11).

---

## Raw Error

```
HEAD /company/select 500 in 76ms
HEAD / 307 in 31ms
⨯ Error [PrismaClientKnownRequestError]:
Invalid `prisma.company.findMany()` invocation in
src\modules\company\repositories\company-repository.ts:29:27

  27 | export const companyRepository = {
  28 |   findMany(filters: CompanyListFilters): Promise<CompanyWithSettings[]> {
> 29 |     return prisma.company.findMany({
     |                           ^
  30 |       where: buildWhere(filters),
  31 |       include: { settings: true },
  32 |       orderBy: { companyName: "asc" },
{
  code: 'ECONNREFUSED',
  meta: { modelName: 'Company' },
  clientVersion: '7.8.0',
}
```

Repeats on every request that touches the `Company` table (`/company/select`, `/` redirecting into it, etc.). `/` itself returns 307 (redirecting to `/company/select` as designed, since `getCurrentCompany()` also hits the DB and is failing the same way, so it falls back to "no active company").

---

## What The Error Is

`ECONNREFUSED` is a TCP-level connection failure — the Prisma driver adapter (`@prisma/adapter-pg`) tried to open a socket to the Postgres server at the address in `DATABASE_URL` and nothing was listening there. It is **not** an application bug: the query itself (`company-repository.ts:29`), the Prisma Client, and the schema are all correct — the database process they're trying to reach simply isn't running.

Confirmed directly before touching anything:

```
.env → DATABASE_URL="postgresql://postgres:postgres@localhost:5432/premgiri_books?schema=public"
netstat -ano | grep :5432   → nothing listening
docker ps -a                → no Postgres container present (running or stopped)
ls docker-compose*          → no compose file in the repo
```

### Root Cause

Every prior phase (04, 05, 08) that needed a live Postgres to run a migration or a smoke test started a **temporary** Docker container (`docker run ... postgres:16-alpine`) and explicitly **stopped and removed it** once verification finished — this is recorded in `context/progress-tracker.md`'s Architecture Decisions: *"a local Postgres server must be running and reachable at this connection string"* and *"no persistent local Postgres server exists in this environment yet."*

That pattern is fine for one-off migration/verification runs, but it means there was never a database left running for normal, everyday `pnpm dev` usage. The moment `pnpm dev` is started outside one of those verification sessions, `DATABASE_URL` points at a Postgres that doesn't exist, and any request touching the DB (which is almost all of them, since Company/FinancialYear/Branch/User all live there) throws `ECONNREFUSED`.

---

## Solution Analyzed (options considered before making changes)

1. **Start another one-off Docker container** — fixes it for the current session only; the exact same error returns the next time the machine restarts or Docker is pruned. Doesn't address the underlying gap.
2. **Add a `docker-compose.yml` to the repo** for a single, documented, repeatable command that brings up a **persistent** local Postgres for development, backed by a named volume so data survives container/machine restarts. — **Chosen.**
3. **Install Postgres natively on the host** — heavier, host-specific, not something that belongs in a script the agent runs; left as an alternative for the user if they prefer it over Docker.
4. **Add a `predev` connectivity check** that fails fast with an actionable message instead of a raw Prisma stack trace when the DB isn't reachable — a good defense-in-depth UX improvement, but doesn't fix the actual missing database, so treated as optional/future, not the primary fix.

Option 2 directly closes the gap the earlier phases' "temporary container" pattern left open, without requiring any host-specific setup, and matches the project's own `.env` connection string exactly.

---

## Solution Applied

- Added `docker-compose.yml` at the repo root: a single `postgres` service (`postgres:16-alpine`), env vars matching `.env`'s `DATABASE_URL` exactly (`POSTGRES_USER=postgres`, `POSTGRES_PASSWORD=postgres`, `POSTGRES_DB=premgiri_books`), port `5432:5432`, and a **named volume** (`premgiri_postgres_data`) so the data directory persists across `docker compose down`/machine restarts — unlike every earlier ad-hoc `docker run` container in this project, this one is meant to be left running for local development, not torn down after each session.
- Brought it up with `docker compose up -d` and confirmed Postgres became ready.
- Re-ran `pnpm prisma migrate deploy` against it (both existing migrations applied cleanly) and regenerated the Prisma Client.
- Verified the actual failure is gone: started `next dev` and requested `/company/select` — it now returns `200` (empty-state "No companies yet" screen) instead of `500`/`ECONNREFUSED`.

### For future sessions / other machines

Bring the database up once with:

```
docker compose up -d
```

It will keep running (and keep its data) until explicitly stopped with `docker compose down` (data persists in the named volume) or `docker compose down -v` (also deletes the data volume). Nothing else in the app changed — this only supplies the previously-missing, always-on local Postgres that `DATABASE_URL` already expected.
