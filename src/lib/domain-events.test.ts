import { describe, it, expect, beforeEach } from "vitest";

import { domainEvents } from "@/lib/domain-events";

const EVENT = "test.event";
const fakeTx = {} as never;

describe("domainEvents", () => {
  beforeEach(() => {
    domainEvents.reset();
  });

  it("resolves without error when no handlers are registered for an event", async () => {
    await expect(domainEvents.emit(EVENT, { value: 1 }, { tx: fakeTx })).resolves.toBeUndefined();
  });

  it("invokes a registered handler with the payload and context", async () => {
    const calls: Array<{ payload: unknown; tx: unknown }> = [];
    domainEvents.on(EVENT, async (payload: { value: number }, ctx) => {
      calls.push({ payload, tx: ctx.tx });
    });

    await domainEvents.emit(EVENT, { value: 42 }, { tx: fakeTx });

    expect(calls).toEqual([{ payload: { value: 42 }, tx: fakeTx }]);
  });

  it("invokes multiple handlers registered at the same order in registration order", async () => {
    const order: string[] = [];
    domainEvents.on(EVENT, async () => {
      order.push("first");
    });
    domainEvents.on(EVENT, async () => {
      order.push("second");
    });

    await domainEvents.emit(EVENT, {}, { tx: fakeTx });

    expect(order).toEqual(["first", "second"]);
  });

  it("invokes handlers sorted by explicit order, regardless of registration order", async () => {
    const order: string[] = [];
    domainEvents.on(EVENT, async () => { order.push("registered-first-order-20"); }, 20);
    domainEvents.on(EVENT, async () => { order.push("registered-second-order-10"); }, 10);

    await domainEvents.emit(EVENT, {}, { tx: fakeTx });

    expect(order).toEqual(["registered-second-order-10", "registered-first-order-20"]);
  });

  it("awaits each handler sequentially rather than running them concurrently", async () => {
    const order: string[] = [];
    domainEvents.on(EVENT, async () => {
      order.push("slow-start");
      await new Promise((resolve) => setTimeout(resolve, 10));
      order.push("slow-end");
    });
    domainEvents.on(EVENT, async () => {
      order.push("fast");
    });

    await domainEvents.emit(EVENT, {}, { tx: fakeTx });

    expect(order).toEqual(["slow-start", "slow-end", "fast"]);
  });

  it("propagates a handler error and stops invoking subsequent handlers", async () => {
    const order: string[] = [];
    domainEvents.on(EVENT, async () => {
      order.push("first");
      throw new Error("boom");
    });
    domainEvents.on(EVENT, async () => {
      order.push("second");
    });

    await expect(domainEvents.emit(EVENT, {}, { tx: fakeTx })).rejects.toThrow("boom");
    expect(order).toEqual(["first"]);
  });

  it("reset(event) clears handlers only for that event", async () => {
    const calls: string[] = [];
    domainEvents.on(EVENT, async () => { calls.push("a"); });
    domainEvents.on("other.event", async () => { calls.push("b"); });

    domainEvents.reset(EVENT);

    await domainEvents.emit(EVENT, {}, { tx: fakeTx });
    await domainEvents.emit("other.event", {}, { tx: fakeTx });

    expect(calls).toEqual(["b"]);
  });

  it("reset() with no argument clears every event", async () => {
    const calls: string[] = [];
    domainEvents.on(EVENT, async () => { calls.push("a"); });

    domainEvents.reset();
    await domainEvents.emit(EVENT, {}, { tx: fakeTx });

    expect(calls).toEqual([]);
  });
});
