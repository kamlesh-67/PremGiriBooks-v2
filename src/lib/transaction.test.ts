import { describe, it, expect, vi, beforeEach } from "vitest";

const transactionMock = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    $transaction: (...args: unknown[]) => transactionMock(...args),
  },
}));

import { AppError } from "@/lib/app-error";
import { runInTransaction } from "@/lib/transaction";

describe("runInTransaction", () => {
  beforeEach(() => {
    transactionMock.mockReset();
  });

  it("runs the callback through prisma.$transaction with no options when none are given", async () => {
    transactionMock.mockResolvedValueOnce("result");
    const fn = vi.fn(async () => "result");

    const result = await runInTransaction(fn);

    expect(result).toBe("result");
    expect(transactionMock).toHaveBeenCalledTimes(1);
    expect(transactionMock).toHaveBeenCalledWith(fn, undefined);
  });

  it("passes the isolation level through to prisma.$transaction", async () => {
    transactionMock.mockResolvedValueOnce("result");
    const fn = vi.fn(async () => "result");

    await runInTransaction(fn, { isolationLevel: "Serializable" });

    expect(transactionMock).toHaveBeenCalledWith(fn, { isolationLevel: "Serializable" });
  });

  it("retries a retryable error and succeeds once the underlying operation succeeds", async () => {
    const retryableError = new Error("write conflict");
    transactionMock
      .mockRejectedValueOnce(retryableError)
      .mockRejectedValueOnce(retryableError)
      .mockResolvedValueOnce("result");
    const fn = vi.fn(async () => "result");

    const result = await runInTransaction(fn, {
      retryable: () => true,
      conflictMessage: "conflict",
    });

    expect(result).toBe("result");
    expect(transactionMock).toHaveBeenCalledTimes(3);
  });

  it("throws an AppError with the conflict message once retries are exhausted", async () => {
    const retryableError = new Error("write conflict");
    transactionMock.mockRejectedValue(retryableError);
    const fn = vi.fn(async () => "result");

    await expect(
      runInTransaction(fn, { retryable: () => true, conflictMessage: "gave up" })
    ).rejects.toThrow(AppError);
    await expect(
      runInTransaction(fn, { retryable: () => true, conflictMessage: "gave up" })
    ).rejects.toThrow("gave up");
  });

  it("uses a default conflict message when none is provided", async () => {
    transactionMock.mockRejectedValue(new Error("write conflict"));
    const fn = vi.fn(async () => "result");

    await expect(runInTransaction(fn, { retryable: () => true })).rejects.toThrow(
      "This record was changed by another request. Please try again."
    );
  });

  it("rethrows a non-retryable error immediately without retrying", async () => {
    const fatalError = new Error("not retryable");
    transactionMock.mockRejectedValueOnce(fatalError);
    const fn = vi.fn(async () => "result");

    await expect(runInTransaction(fn, { retryable: () => false })).rejects.toBe(fatalError);
    expect(transactionMock).toHaveBeenCalledTimes(1);
  });

  it("calls onRetry before each retried attempt, with the current and max attempt numbers", async () => {
    const retryableError = new Error("write conflict");
    transactionMock
      .mockRejectedValueOnce(retryableError)
      .mockRejectedValueOnce(retryableError)
      .mockResolvedValueOnce("result");
    const onRetry = vi.fn();

    await runInTransaction(async () => "result", { retryable: () => true, onRetry });

    expect(onRetry).toHaveBeenCalledTimes(2);
    expect(onRetry).toHaveBeenNthCalledWith(1, 1, 3);
    expect(onRetry).toHaveBeenNthCalledWith(2, 2, 3);
  });

  it("calls onRetriesExhausted instead of onRetry on the final failed attempt", async () => {
    transactionMock.mockRejectedValue(new Error("write conflict"));
    const onRetry = vi.fn();
    const onRetriesExhausted = vi.fn();

    await expect(
      runInTransaction(async () => "result", { retryable: () => true, onRetry, onRetriesExhausted })
    ).rejects.toThrow(AppError);

    expect(onRetry).toHaveBeenCalledTimes(2);
    expect(onRetriesExhausted).toHaveBeenCalledTimes(1);
    expect(onRetriesExhausted).toHaveBeenCalledWith(3, 3);
  });
});
