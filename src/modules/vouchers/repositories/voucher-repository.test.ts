import { describe, expect, it, vi, beforeEach } from "vitest";

// Mirrors price-list-repository.test.ts's convention — mock the Prisma
// client boundary rather than hitting a real database from a unit test.
const {
  voucherCreateMock,
  voucherFindUniqueMock,
  voucherFindManyMock,
  voucherUpdateMock,
  ledgerFindUniqueMock,
  ledgerFindManyMock,
  voucherEntryFindManyMock,
  voucherEntryGroupByMock,
} = vi.hoisted(() => ({
  voucherCreateMock: vi.fn(),
  voucherFindUniqueMock: vi.fn(),
  voucherFindManyMock: vi.fn(),
  voucherUpdateMock: vi.fn(),
  ledgerFindUniqueMock: vi.fn(),
  ledgerFindManyMock: vi.fn(),
  voucherEntryFindManyMock: vi.fn(),
  voucherEntryGroupByMock: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    voucher: {
      create: (...args: unknown[]) => voucherCreateMock(...args),
      findUnique: (...args: unknown[]) => voucherFindUniqueMock(...args),
      findMany: (...args: unknown[]) => voucherFindManyMock(...args),
      update: (...args: unknown[]) => voucherUpdateMock(...args),
    },
    ledger: {
      findUnique: (...args: unknown[]) => ledgerFindUniqueMock(...args),
      findMany: (...args: unknown[]) => ledgerFindManyMock(...args),
    },
    voucherEntry: {
      findMany: (...args: unknown[]) => voucherEntryFindManyMock(...args),
      groupBy: (...args: unknown[]) => voucherEntryGroupByMock(...args),
    },
  },
}));

import { voucherRepository } from "@/modules/vouchers/repositories/voucher-repository";
import type { PostedVoucher } from "@/engines/voucher/types";

const COMPANY_ID = "11111111-1111-4111-8111-111111111111";
const OTHER_COMPANY_ID = "99999999-9999-4999-8999-999999999999";
const FY_ID = "22222222-2222-4222-8222-222222222222";
const LEDGER_A = "33333333-3333-4333-8333-333333333333";
const LEDGER_B = "44444444-4444-4444-8444-444444444444";

function decimal(value: number) {
  return { toNumber: () => value };
}

function fakeTx() {
  return {
    voucher: { create: voucherCreateMock, update: voucherUpdateMock, findUnique: voucherFindUniqueMock },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any;
}

beforeEach(() => {
  voucherCreateMock.mockReset();
  voucherFindUniqueMock.mockReset();
  voucherFindManyMock.mockReset();
  voucherUpdateMock.mockReset();
  ledgerFindUniqueMock.mockReset();
  ledgerFindManyMock.mockReset();
  voucherEntryFindManyMock.mockReset();
  voucherEntryGroupByMock.mockReset();
});

describe("voucherRepository.create", () => {
  it("sums only the DEBIT entries (in paise) for totalAmount and assigns 1-based lineNumbers", async () => {
    voucherCreateMock.mockResolvedValueOnce({
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
      totalAmount: decimal(100),
      reversalOfId: null,
      createdByUserId: null,
      createdAt: new Date("2026-04-15T00:00:00.000Z"),
      updatedAt: new Date("2026-04-15T00:00:00.000Z"),
      entries: [
        { id: "e-1", ledgerId: LEDGER_A, entryType: "DEBIT", amount: decimal(100), lineNumber: 1 },
        { id: "e-2", ledgerId: LEDGER_B, entryType: "CREDIT", amount: decimal(100), lineNumber: 2 },
      ],
    });

    await voucherRepository.create(
      fakeTx(),
      COMPANY_ID,
      {
        financialYearId: FY_ID,
        voucherType: "PAYMENT",
        voucherDate: new Date("2026-04-15T00:00:00.000Z"),
        entries: [
          { ledgerId: LEDGER_A, entryType: "DEBIT", amount: 100 },
          { ledgerId: LEDGER_B, entryType: "CREDIT", amount: 100 },
        ],
      },
      { documentSequenceId: "seq-1", number: 1, formatted: "PMT-0001" }
    );

    expect(voucherCreateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          companyId: COMPANY_ID,
          voucherNumber: "PMT-0001",
          totalAmount: 100,
          narration: null,
          referenceType: null,
          referenceId: null,
          entries: {
            create: [
              { ledgerId: LEDGER_A, entryType: "DEBIT", amount: 100, lineNumber: 1 },
              { ledgerId: LEDGER_B, entryType: "CREDIT", amount: 100, lineNumber: 2 },
            ],
          },
        }),
      })
    );
  });
});

describe("voucherRepository.reverse", () => {
  const original: PostedVoucher = {
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
  };

  it("mirrors every entry (DEBIT<->CREDIT), sets reversalOfId and narration, and flips the original to CANCELLED", async () => {
    voucherCreateMock.mockResolvedValueOnce({
      id: "v-2",
      companyId: COMPANY_ID,
      financialYearId: FY_ID,
      voucherType: "PAYMENT",
      voucherNumber: "PMT-0002",
      voucherDate: original.voucherDate,
      status: "POSTED",
      narration: "Reversal of PMT-0001",
      referenceType: null,
      referenceId: null,
      totalAmount: decimal(100),
      reversalOfId: "v-1",
      createdByUserId: null,
      createdAt: original.createdAt,
      updatedAt: original.updatedAt,
      entries: [
        { id: "e-3", ledgerId: LEDGER_A, entryType: "CREDIT", amount: decimal(100), lineNumber: 1 },
        { id: "e-4", ledgerId: LEDGER_B, entryType: "DEBIT", amount: decimal(100), lineNumber: 2 },
      ],
    });
    voucherUpdateMock.mockResolvedValueOnce({});

    const result = await voucherRepository.reverse(fakeTx(), COMPANY_ID, original, {
      documentSequenceId: "seq-1",
      number: 2,
      formatted: "PMT-0002",
    });

    expect(voucherCreateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          reversalOfId: "v-1",
          narration: "Reversal of PMT-0001",
          voucherDate: original.voucherDate,
          entries: {
            create: [
              { ledgerId: LEDGER_A, entryType: "CREDIT", amount: 100, lineNumber: 1 },
              { ledgerId: LEDGER_B, entryType: "DEBIT", amount: 100, lineNumber: 2 },
            ],
          },
        }),
      })
    );
    expect(voucherUpdateMock).toHaveBeenCalledWith({ where: { id: "v-1" }, data: { status: "CANCELLED" } });
    expect(result.entries.map((e) => e.entryType)).toEqual(["CREDIT", "DEBIT"]);
  });
});

describe("voucherRepository.findById", () => {
  it("returns null when the voucher does not exist", async () => {
    voucherFindUniqueMock.mockResolvedValueOnce(null);
    await expect(voucherRepository.findById("missing")).resolves.toBeNull();
  });

  it("normalizes Decimal fields and sorts entries by lineNumber", async () => {
    voucherFindUniqueMock.mockResolvedValueOnce({
      id: "v-1",
      companyId: COMPANY_ID,
      financialYearId: FY_ID,
      voucherType: "JOURNAL",
      voucherNumber: "JRN-0001",
      voucherDate: new Date("2026-04-15T00:00:00.000Z"),
      status: "POSTED",
      narration: null,
      referenceType: null,
      referenceId: null,
      totalAmount: decimal(250),
      reversalOfId: null,
      createdByUserId: null,
      createdAt: new Date("2026-04-15T00:00:00.000Z"),
      updatedAt: new Date("2026-04-15T00:00:00.000Z"),
      entries: [
        { id: "e-2", ledgerId: LEDGER_B, entryType: "CREDIT", amount: decimal(250), lineNumber: 2 },
        { id: "e-1", ledgerId: LEDGER_A, entryType: "DEBIT", amount: decimal(250), lineNumber: 1 },
      ],
    });

    const result = await voucherRepository.findById("v-1");
    expect(result?.totalAmount).toBe(250);
    expect(result?.entries.map((e) => e.id)).toEqual(["e-1", "e-2"]);
    expect(result?.entries[0].amount).toBe(250);
  });
});

describe("voucherRepository.findLedgerForBalance", () => {
  it("returns null for a cross-company ledger (resolves as not-found)", async () => {
    ledgerFindUniqueMock.mockResolvedValueOnce({
      id: LEDGER_A,
      companyId: OTHER_COMPANY_ID,
      openingBalance: decimal(0),
      openingBalanceType: "DEBIT",
    });
    await expect(voucherRepository.findLedgerForBalance(COMPANY_ID, LEDGER_A)).resolves.toBeNull();
  });

  it("normalizes the opening balance for an owned ledger", async () => {
    ledgerFindUniqueMock.mockResolvedValueOnce({
      id: LEDGER_A,
      companyId: COMPANY_ID,
      openingBalance: decimal(500),
      openingBalanceType: "CREDIT",
    });
    await expect(voucherRepository.findLedgerForBalance(COMPANY_ID, LEDGER_A)).resolves.toEqual({
      id: LEDGER_A,
      openingBalance: 500,
      openingBalanceType: "CREDIT",
    });
  });
});

describe("voucherRepository.aggregateEntriesByLedger", () => {
  it("defaults a null Prisma sum to zero", async () => {
    voucherEntryGroupByMock.mockResolvedValueOnce([{ ledgerId: LEDGER_A, entryType: "DEBIT", _sum: { amount: null } }]);
    const result = await voucherRepository.aggregateEntriesByLedger(COMPANY_ID, FY_ID);
    expect(result).toEqual([{ ledgerId: LEDGER_A, entryType: "DEBIT", amount: 0 }]);
  });

  it("normalizes a real Decimal sum", async () => {
    voucherEntryGroupByMock.mockResolvedValueOnce([{ ledgerId: LEDGER_A, entryType: "CREDIT", _sum: { amount: decimal(1234.5) } }]);
    const result = await voucherRepository.aggregateEntriesByLedger(COMPANY_ID, FY_ID);
    expect(result).toEqual([{ ledgerId: LEDGER_A, entryType: "CREDIT", amount: 1234.5 }]);
  });
});
