/**
 * Side-effect-only wiring for tenant-bootstrap-service.ts's
 * "company.bootstrapped" domain event — the one place that knows every
 * module participating in company bootstrap, so tenant-bootstrap-service.ts
 * itself doesn't have to. Import this file (never the individual handler
 * modules) wherever the event needs to actually fire; each import below
 * registers its handler as a side effect of module evaluation.
 *
 * Add a line here when a future module (e.g. Expense Heads, Income Heads)
 * needs its own defaults seeded on company creation — no change to
 * tenant-bootstrap-service.ts required.
 */
import "@/modules/ledger-groups/events/register-bootstrap-handler";
import "@/modules/ledgers/events/register-bootstrap-handler";
