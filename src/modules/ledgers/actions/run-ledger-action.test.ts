import { beforeEach, describe, expect, it, vi } from "vitest";

import { AppError } from "@/lib/app-error";
import { runLedgerAction } from "@/modules/ledgers/actions/run-ledger-action";

const { revalidatePathMock, warnMock } = vi.hoisted(() => ({
  revalidatePathMock: vi.fn(),
  warnMock: vi.fn(),
}));

vi.mock("next/cache", () => ({
  revalidatePath: revalidatePathMock,
}));

vi.mock("@/lib/logger", () => ({
  logger: { warn: warnMock, error: vi.fn() },
}));

describe("runLedgerAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns the operation result and revalidates every path on success", async () => {
    const result = await runLedgerAction(async () => ({ id: "l1" }), ["/a", "/b"]);

    expect(result).toEqual({ success: true, data: { id: "l1" } });
    expect(revalidatePathMock.mock.calls).toEqual([["/a"], ["/b"]]);
  });

  it("returns a failure without revalidating when the operation throws", async () => {
    const result = await runLedgerAction(async () => {
      throw new AppError("Ledger not found.");
    }, ["/a"]);

    expect(result).toEqual({ success: false, error: "Ledger not found." });
    expect(revalidatePathMock).not.toHaveBeenCalled();
  });

  it("still reports success when revalidatePath throws after the operation committed", async () => {
    revalidatePathMock.mockImplementationOnce(() => {
      throw new Error("static generation store missing");
    });

    const result = await runLedgerAction(async () => ({ id: "l1" }), ["/a", "/b"]);

    // The mutation persisted — a cache-invalidation failure must not surface
    // as a failed action (it would invite retrying work that succeeded).
    expect(result).toEqual({ success: true, data: { id: "l1" } });
    expect(warnMock).toHaveBeenCalledTimes(1);
    // The remaining paths are still revalidated despite the first throwing.
    expect(revalidatePathMock.mock.calls).toEqual([["/a"], ["/b"]]);
  });
});
