import { domainEvents } from "@/lib/domain-events";
import { DOMAIN_EVENTS, type CompanyBootstrappedPayload } from "@/constants/domain-events";
import { ledgerGroupService } from "@/modules/ledger-groups/services/ledger-group-service";

// order 10 — must run before the ledgers module's handler (order 20), which
// seeds the default "Cash" ledger under the "Cash in Hand" group this
// handler creates. Imported for its side effect (registration) by
// tenant-bootstrap-events.ts; never imported directly by
// tenant-bootstrap-service.ts, per Architecture Improvement Recommendations
// #3 (Internal Domain Events) — the emitter only knows the event name.
domainEvents.on<CompanyBootstrappedPayload>(
  DOMAIN_EVENTS.COMPANY_BOOTSTRAPPED,
  async ({ companyId }, { tx }) => {
    await ledgerGroupService.seedDefaultGroups(companyId, tx);
  },
  10
);
