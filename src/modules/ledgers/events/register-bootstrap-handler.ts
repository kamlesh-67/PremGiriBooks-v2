import { domainEvents } from "@/lib/domain-events";
import { DOMAIN_EVENTS, type CompanyBootstrappedPayload } from "@/constants/domain-events";
import { ledgerService } from "@/modules/ledgers/services/ledger-service";

// order 20 — must run after the ledger-groups module's handler (order 10),
// which seeds the "Cash in Hand" group this handler's default "Cash" ledger
// is created under. See that file's comment for the shared reasoning.
domainEvents.on<CompanyBootstrappedPayload>(
  DOMAIN_EVENTS.COMPANY_BOOTSTRAPPED,
  async ({ companyId }, { tx }) => {
    await ledgerService.seedDefaultLedger(companyId, tx);
  },
  20
);
