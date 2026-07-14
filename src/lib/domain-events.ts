import type { Prisma } from "@prisma/client";

export interface DomainEventContext {
  tx: Prisma.TransactionClient;
}

export type DomainEventHandler<TPayload> = (
  payload: TPayload,
  ctx: DomainEventContext
) => Promise<void>;

interface RegisteredHandler {
  handler: DomainEventHandler<never>;
  order: number;
}

/**
 * Lightweight in-process domain event bus (Architecture Improvement
 * Recommendations, Priority 1 #3 — Internal Domain Events). No message
 * broker: handlers run in-process, in the same transaction as the emitter,
 * awaited sequentially in `order` (registration order breaks ties) so a
 * later handler can depend on an earlier one having already written to
 * `ctx.tx`. A handler that throws aborts every handler after it and
 * propagates to the emitter, so the whole transaction still rolls back
 * together — this is a decoupling mechanism for *who* reacts to an event,
 * not a way to make side effects independent of the caller's transaction.
 *
 * Modules register their own handlers at import time (self-registration);
 * the emitting service only needs to know the event name, not which modules
 * are listening — see tenant-bootstrap-service.ts for the first real user.
 */
class DomainEventBus {
  private readonly handlersByEvent = new Map<string, RegisteredHandler[]>();

  on<TPayload>(event: string, handler: DomainEventHandler<TPayload>, order = 0): void {
    const handlers = this.handlersByEvent.get(event) ?? [];
    handlers.push({ handler: handler as DomainEventHandler<never>, order });
    this.handlersByEvent.set(event, handlers);
  }

  async emit<TPayload>(event: string, payload: TPayload, ctx: DomainEventContext): Promise<void> {
    const handlers = [...(this.handlersByEvent.get(event) ?? [])].sort((a, b) => a.order - b.order);
    for (const { handler } of handlers) {
      await handler(payload as never, ctx);
    }
  }

  /** Test-only: clears handlers for one event, or every event when called with no argument. */
  reset(event?: string): void {
    if (event) {
      this.handlersByEvent.delete(event);
    } else {
      this.handlersByEvent.clear();
    }
  }
}

export const domainEvents = new DomainEventBus();
