import { describe, expect, it, vi, beforeEach } from "vitest";

// Mirrors pricing-engine.test.ts's convention — mock the module-boundary
// repository and the sibling engine this one calls through, plus the
// Prisma client boundary that runInTransaction ultimately drives (so
// postVoucher/cancelVoucher's own-transaction path runs the callback
// against a fake tx instead of a real database).
const {
  findByIdMock,
  findFinancialYearMock,
  findLedgersForPostingMock,
  createMock,
  reverseMock,
  findManyMock,
  ensureSequenceMock,
  generateNumberMock,
  FAKE_TX,
} = vi.hoisted(() => ({
  findByIdMock: vi.fn(),
  findFinancialYearMock: vi.fn(),
  findLedgersForPostingMock: vi.fn(),
  createMock: vi.fn(),
  reverseMock: vi.fn(),
  findManyMock: vi.fn(),
  ensureSequenceMock: vi.fn(),
  generateNumberMock: vi.fn(),
  FAKE_TX: { marker: "fake-tx" },
}));

vi.mock("@/modules/vouchers/repositories/voucher-repository", () => ({
  voucherRepository: {
    findById: findByIdMock,
    findFinancialYear: findFinancialYearMock,
    findLedgersForPosting: findLedgersForPostingMock,
    create: createMock,
    reverse: reverseMock,
    findMany: findManyMock,
  },
}));

vi.mock("@/engines/document-number/document-number-engine", () => ({
  documentNumberEngine: { ensureSequence: ensureSequenceMock, generateNumber: generateNumberMock },
}));

vi.mock("@/lib/prisma", () => ({
  prisma: { $transaction: (fn: (tx: unknown) => unknown) => fn(FAKE_TX) },
}));

import { AppError } from "@/lib/app-error";
import { cancelVoucher, getVoucher, listVouchers, postVoucher } from "@/engines/voucher/voucher-engine";
import type { PostedVoucher } from "@/engines/voucher/types";

const COMPANY_ID = "11111111-1111-4111-8111-111111111111";
const OTHER_COMPANY_ID = "99999999-9999-4999-8999-999999999999";
const FY_ID = "22222222-2222-4222-8222-222222222222";
const LEDGER_A = "33333333-3333-4333-8333-333333333333";
const LEDGER_B = "44444444-4444-4444-8444-444444444444";

const OPEN_FY = {
  id: FY_ID,
  companyId: COMPANY_ID,
  isClosed: false,
  startDate: new Date("2026-04-01T00:00:00.000Z"),
  endDate: new Date("2027-03-31T00:00:00.000Z"),
};

const ACTIVE_LEDGERS = [
  { id: LEDGER_A, companyId: COMPANY_ID, name: "Cash", isActive: true },
  { id: LEDGER_B, companyId: COMPANY_ID, name: "Sales", isActive: true },
];

function validInput(overrides: Record<string, unknown> = {}) {
  return {
    financialYearId: FY_ID,
    voucherType: "PAYMENT",
    voucherDate: "2026-04-15",
    entries: [
      { ledgerId: LEDGER_A, entryType: "DEBIT", amount: 100 },
      { ledgerId: LEDGER_B, entryType: "CREDIT", amount: 100 },
    ],
    ...overrides,
  };
}

function postedVoucher(overrides: Partial<PostedVoucher> = {}): PostedVoucher {
  return {
    id: "v-1",
    companyId: COMPANY_ID,
    financialYearId: FY_ID,
    voucherType: "PAYMENT",
    voucherNumber: "PMT-0001",
    voucherDate: new Date("2026-04-15T00:00:00.000Z"),
    status: "POSTED",
    narration: null,
    referenceType: null,
    referenceId: null,
    totalAmount: 100,
    reversalOfId: null,
    createdByUserId: null,
    createdAt: new Date("2026-04-15T00:00:00.000Z"),
    updatedAt: new Date("2026-04-15T00:00:00.000Z"),
    entries: [
      { id: "e-1", ledgerId: LEDGER_A, entryType: "DEBIT", amount: 100, lineNumber: 1 },
      { id: "e-2", ledgerId: LEDGER_B, entryType: "CREDIT", amount: 100, lineNumber: 2 },
    ],
    ...overrides,
  };
}

beforeEach(() => {
  findByIdMock.mockReset();
  findFinancialYearMock.mockReset();
  findLedgersForPostingMock.mockReset();
  createMock.mockReset();
  reverseMock.mockReset();
  findManyMock.mockReset();
  ensureSequenceMock.mockReset();
  generateNumberMock.mockReset();

  findFinancialYearMock.mockResolvedValue(OPEN_FY);
  findLedgersForPostingMock.mockResolvedValue(ACTIVE_LEDGERS);
  generateNumberMock.mockResolvedValue({ documentSequenceId: "seq-1", number: 1, formatted: "PMT-0001" });
  createMock.mockResolvedValue(postedVoucher());
});

describe("postVoucher — own-transaction path", () => {
  it("calls ensureSequence with the mapped document type before opening the transaction, then posts", async () => {
    const result = await postVoucher(COMPANY_ID, validInput());

    expect(ensureSequenceMock).toHaveBeenCalledWith(COMPANY_ID, FY_ID, "PAYMENT_VOUCHER");
    expect(generateNumberMock).toHaveBeenCalledWith(FAKE_TX, {
      companyId: COMPANY_ID,
      financialYearId: FY_ID,
      documentType: "PAYMENT_VOUCHER",
    });
    expect(createMock).toHaveBeenCalledWith(
      FAKE_TX,
      COMPANY_ID,
      expect.objectContaining({ financialYearId: FY_ID }),
      { documentSequenceId: "seq-1", number: 1, formatted: "PMT-0001" }
    );
    expect(result.voucherNumber).toBe("PMT-0001");
  });

  it("rejects when the financial year does not exist", async () => {
    findFinancialYearMock.mockResolvedValueOnce(null);
    await expect(postVoucher(COMPANY_ID, validInput())).rejects.toThrow("Financial year not found.");
  });

  it("rejects when the financial year belongs to a different company", async () => {
    findFinancialYearMock.mockResolvedValueOnce({ ...OPEN_FY, companyId: OTHER_COMPANY_ID });
    await expect(postVoucher(COMPANY_ID, validInput())).rejects.toThrow("Financial year not found.");
  });

  it("rejects posting into a closed financial year", async () => {
    findFinancialYearMock.mockResolvedValueOnce({ ...OPEN_FY, isClosed: true });
    await expect(postVoucher(COMPANY_ID, validInput())).rejects.toThrow("closed financial year");
  });

  it("rejects a voucher date outside the financial year's range", async () => {
    await expect(postVoucher(COMPANY_ID, validInput({ voucherDate: "2025-01-01" }))).rejects.toThrow(
      "date must fall within the financial year"
    );
  });

  it("rejects when a ledger does not exist or belongs to another company", async () => {
    findLedgersForPostingMock.mockResolvedValueOnce([{ ...ACTIVE_LEDGERS[0], companyId: OTHER_COMPANY_ID }, ACTIVE_LEDGERS[1]]);
    await expect(postVoucher(COMPANY_ID, validInput())).rejects.toThrow("One or more ledgers were not found.");
  });

  it("rejects when a ledger is inactive", async () => {
    findLedgersForPostingMock.mockResolvedValueOnce([{ ...ACTIVE_LEDGERS[0], isActive: false }, ACTIVE_LEDGERS[1]]);
    await expect(postVoucher(COMPANY_ID, validInput())).rejects.toThrow('Ledger "Cash" is inactive');
  });

  it("rejects an unbalanced or malformed voucher before any repository call", async () => {
    await expect(
      postVoucher(
        COMPANY_ID,
        validInput({
          entries: [
            { ledgerId: LEDGER_A, entryType: "DEBIT", amount: 100 },
            { ledgerId: LEDGER_B, entryType: "CREDIT", amount: 90 },
          ],
        })
      )
    ).rejects.toThrow();
    expect(ensureSequenceMock).not.toHaveBeenCalled();
  });
});

describe("postVoucher — caller-supplied transaction", () => {
  it("skips ensureSequence and uses the passed transaction directly", async () => {
    const callerTx = { marker: "caller-tx" } as unknown as Parameters<typeof postVoucher>[2];

    await postVoucher(COMPANY_ID, validInput(), callerTx);

    expect(ensureSequenceMock).not.toHaveBeenCalled();
    expect(generateNumberMock).toHaveBeenCalledWith(callerTx, expect.any(Object));
    expect(createMock).toHaveBeenCalledWith(callerTx, COMPANY_ID, expect.any(Object), expect.any(Object));
  });
});

describe("cancelVoucher", () => {
  beforeEach(() => {
    findByIdMock.mockResolvedValue(postedVoucher());
    reverseMock.mockResolvedValue(postedVoucher({ id: "v-2", voucherNumber: "PMT-0002", reversalOfId: "v-1" }));
  });

  it("rejects when the voucher does not exist", async () => {
    findByIdMock.mockResolvedValueOnce(null);
    await expect(cancelVoucher(COMPANY_ID, "missing")).rejects.toThrow("Voucher not found.");
  });

  it("rejects when the voucher belongs to a different company", async () => {
    findByIdMock.mockResolvedValueOnce(postedVoucher({ companyId: OTHER_COMPANY_ID }));
    await expect(cancelVoucher(COMPANY_ID, "v-1")).rejects.toThrow("Voucher not found.");
  });

  it("rejects cancelling a reversal voucher", async () => {
    findByIdMock.mockResolvedValueOnce(postedVoucher({ reversalOfId: "some-original" }));
    await expect(cancelVoucher(COMPANY_ID, "v-1")).rejects.toThrow("A reversal voucher cannot be cancelled.");
  });

  it("rejects cancelling an already-cancelled voucher (double-cancel)", async () => {
    findByIdMock.mockResolvedValueOnce(postedVoucher({ status: "CANCELLED" }));
    await expect(cancelVoucher(COMPANY_ID, "v-1")).rejects.toThrow("Only a posted voucher can be cancelled.");
  });

  it("rejects cancelling into a closed financial year", async () => {
    findFinancialYearMock.mockResolvedValueOnce({ ...OPEN_FY, isClosed: true });
    await expect(cancelVoucher(COMPANY_ID, "v-1")).rejects.toThrow("closed financial year");
  });

  it("rejects a concurrent double-cancel caught by the in-transaction re-check", async () => {
    // First lookup (pre-transaction) sees POSTED; the in-transaction re-fetch
    // sees a concurrent cancellation that already flipped it.
    findByIdMock.mockResolvedValueOnce(postedVoucher());
    findByIdMock.mockResolvedValueOnce(postedVoucher({ status: "CANCELLED" }));

    await expect(cancelVoucher(COMPANY_ID, "v-1")).rejects.toThrow("Only a posted voucher can be cancelled.");
    expect(reverseMock).not.toHaveBeenCalled();
  });

  it("posts the mirrored reversal and returns it", async () => {
    const result = await cancelVoucher(COMPANY_ID, "v-1");

    expect(ensureSequenceMock).toHaveBeenCalledWith(COMPANY_ID, FY_ID, "PAYMENT_VOUCHER");
    expect(reverseMock).toHaveBeenCalledWith(FAKE_TX, COMPANY_ID, expect.objectContaining({ id: "v-1" }), {
      documentSequenceId: "seq-1",
      number: 1,
      formatted: "PMT-0001",
    });
    expect(result.reversalOfId).toBe("v-1");
  });
});

describe("getVoucher", () => {
  it("returns null for a cross-company voucher", async () => {
    findByIdMock.mockResolvedValueOnce(postedVoucher({ companyId: OTHER_COMPANY_ID }));
    await expect(getVoucher(COMPANY_ID, "v-1")).resolves.toBeNull();
  });

  it("returns the voucher when it belongs to the company", async () => {
    findByIdMock.mockResolvedValueOnce(postedVoucher());
    await expect(getVoucher(COMPANY_ID, "v-1")).resolves.toMatchObject({ id: "v-1" });
  });
});

describe("listVouchers", () => {
  it("delegates to the repository with the company scope", async () => {
    findManyMock.mockResolvedValueOnce([postedVoucher()]);
    const result = await listVouchers(COMPANY_ID, { status: "POSTED" });
    expect(findManyMock).toHaveBeenCalledWith(COMPANY_ID, { status: "POSTED" });
    expect(result).toHaveLength(1);
  });
});

describe("AppError propagation", () => {
  it("rejection errors are instances of AppError, safe to surface to the client", async () => {
    findFinancialYearMock.mockResolvedValueOnce(null);
    await expect(postVoucher(COMPANY_ID, validInput())).rejects.toBeInstanceOf(AppError);
  });
});
