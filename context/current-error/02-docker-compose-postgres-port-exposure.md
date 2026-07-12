# 02 - docker-compose Postgres Port Bound to All Interfaces

## Status

Verified against current code and resolved (2026-07-11).

---

## Finding (from code review)

> In `docker-compose.yml` around lines 6-10, update the PostgreSQL service's ports mapping in the
> compose configuration to bind host port 5432 explicitly to `127.0.0.1`, preserving the container
> port and existing database settings.

## What The Error Is

`docker-compose.yml` (added in [00-prisma-postgres-econnrefused.md](00-prisma-postgres-econnrefused.md)
to give local dev a persistent Postgres) declared its port mapping as:

```yaml
ports:
  - "5432:5432"
```

Docker's short port-mapping syntax `HOST:CONTAINER` binds the host side to **all** network
interfaces (`0.0.0.0`) by default, not just loopback. Combined with the fact that this container
uses default, hardcoded credentials (`postgres` / `postgres`) meant only for local development,
that meant Postgres was reachable from any other machine on the same network the host is
connected to (LAN, shared office network, public Wi-Fi, etc.) — not just from the developer's own
machine. A local dev database with weak default credentials should never be reachable outside the
host itself.

## Verification Against Current Code

Confirmed the finding was still accurate before changing anything:

```console
docker port premgir-books-v2-postgres-1
→ 5432/tcp -> 0.0.0.0:5432   (before the fix)
```

This matched the `docker-compose.yml` as committed — the finding was valid, not stale, so it was
fixed rather than skipped.

## Solution Analyzed

1. **Bind the host side explicitly to `127.0.0.1`** (`"127.0.0.1:5432:5432"`) — restricts the
   container to loopback-only, so only processes on the same machine (the Next.js dev server,
   `psql`, etc.) can reach it. Zero behavior change for local development, since Prisma connects
   via `localhost`, which resolves to `127.0.0.1`. — **Chosen.**
2. **Remove the host port mapping entirely** and have the app connect over the Docker network
   instead — not viable here, since `pnpm dev`/`next dev` and Prisma CLI commands run directly on
   the host, not inside a container, so they need a host-reachable port.
3. **Change the default credentials** — worth doing in general, but doesn't address the actual
   finding (network exposure); a compromised-network attacker could still reach the port even with
   stronger credentials. Treated as a separate, unrelated hardening concern, not in scope here.

Option 1 is the minimal change that directly closes the exposure the finding describes, with no
impact on local usage.

## Solution Applied

```diff
     ports:
-      - "5432:5432"
+      - "127.0.0.1:5432:5432"
```

Verified:

- `docker compose up -d` recreated the container with the new mapping.
- `docker port premgir-books-v2-postgres-1` → `5432/tcp -> 127.0.0.1:5432` (loopback-only, no more
  `0.0.0.0` binding).
- `pnpm prisma migrate deploy` still connects successfully via `localhost:5432` — no change needed
  in `.env`'s `DATABASE_URL` or anywhere else in the app.
