import { beforeEach, describe, expect, it, vi } from "vitest";

import { AppError } from "@/lib/app-error";
import { runAction } from "@/lib/run-action";

const { revalidatePathMock, warnMock, errorMock } = vi.hoisted(() => ({
  revalidatePathMock: vi.fn(),
  warnMock: vi.fn(),
  errorMock: vi.fn(),
}));

vi.mock("next/cache", () => ({
  revalidatePath: revalidatePathMock,
}));

vi.mock("@/lib/logger", () => ({
  logger: { warn: warnMock, error: errorMock },
}));

describe("runAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns the operation result and revalidates every path on success", async () => {
    const result = await runAction(async () => ({ id: "l1" }), ["/a", "/b"]);

    expect(result).toEqual({ success: true, data: { id: "l1" } });
    expect(revalidatePathMock.mock.calls).toEqual([["/a"], ["/b"]]);
  });

  it("returns a failure without revalidating when the operation throws", async () => {
    const result = await runAction(async () => {
      throw new AppError("Ledger not found.");
    }, ["/a"]);

    expect(result).toEqual({ success: false, error: "Ledger not found." });
    expect(revalidatePathMock).not.toHaveBeenCalled();
  });

  it("replaces a generic operation error with the generic message and logs it server-side", async () => {
    const thrown = new Error("connect ECONNREFUSED 127.0.0.1:5432");

    const result = await runAction(async () => {
      throw thrown;
    }, ["/a"]);

    // toActionErrorMessage runs unmocked here: a non-AppError/non-ZodError
    // must never surface its own message to the client — only the generic
    // fallback, with the real error logged via Pino.
    expect(result).toEqual({ success: false, error: "Something went wrong. Please try again." });
    expect(errorMock).toHaveBeenCalledWith({ err: thrown }, "Unhandled Server Action error");
    expect(revalidatePathMock).not.toHaveBeenCalled();
  });

  it("still reports success when revalidatePath throws after the operation committed", async () => {
    revalidatePathMock.mockImplementationOnce(() => {
      throw new Error("static generation store missing");
    });

    const result = await runAction(async () => ({ id: "l1" }), ["/a", "/b"]);

    // The mutation persisted — a cache-invalidation failure must not surface
    // as a failed action (it would invite retrying work that succeeded).
    expect(result).toEqual({ success: true, data: { id: "l1" } });
    expect(warnMock).toHaveBeenCalledTimes(1);
    // The remaining paths are still revalidated despite the first throwing.
    expect(revalidatePathMock.mock.calls).toEqual([["/a"], ["/b"]]);
  });
});
