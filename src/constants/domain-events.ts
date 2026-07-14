/**
 * Central registry of in-process domain event names (see
 * src/lib/domain-events.ts) and their payload shapes — kept here, not
 * inline at each emit()/on() call site, so an event's name and payload type
 * have exactly one source of truth shared by the emitter and every handler.
 */
export const DOMAIN_EVENTS = {
  /**
   * Emitted by tenant-bootstrap-service.ts once a brand-new company's
   * Financial Year and default Roles have been created (those two return
   * values the emitting transaction still needs directly, so they stay
   * plain awaited calls — see tenant-bootstrap-service.ts). Every other
   * per-company seeding step that only produces a side effect subscribes to
   * this event instead of being called directly, so TenantBootstrapService
   * no longer needs to import each seeding module by name.
   */
  COMPANY_BOOTSTRAPPED: "company.bootstrapped",
} as const;

export interface CompanyBootstrappedPayload {
  companyId: string;
}
