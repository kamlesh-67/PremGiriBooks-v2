import { describe, expect, it, vi, beforeEach } from "vitest";

const { findLedgerForBalanceMock, findLedgerEntriesUpToMock, findLedgersForTrialBalanceMock, aggregateEntriesByLedgerMock, findFinancialYearMock } =
  vi.hoisted(() => ({
    findLedgerForBalanceMock: vi.fn(),
    findLedgerEntriesUpToMock: vi.fn(),
    findLedgersForTrialBalanceMock: vi.fn(),
    aggregateEntriesByLedgerMock: vi.fn(),
    findFinancialYearMock: vi.fn(),
  }));

vi.mock("@/modules/vouchers/repositories/voucher-repository", () => ({
  voucherRepository: {
    findLedgerForBalance: findLedgerForBalanceMock,
    findLedgerEntriesUpTo: findLedgerEntriesUpToMock,
    findLedgersForTrialBalance: findLedgersForTrialBalanceMock,
    aggregateEntriesByLedger: aggregateEntriesByLedgerMock,
    findFinancialYear: findFinancialYearMock,
  },
}));

vi.mock("@/lib/prisma", () => ({ prisma: {} }));

import { getLedgerBalance, getLedgerStatement, getTrialBalance } from "@/engines/voucher/voucher-queries";

const COMPANY_ID = "11111111-1111-4111-8111-111111111111";
const OTHER_COMPANY_ID = "99999999-9999-4999-8999-999999999999";
const FY_ID = "22222222-2222-4222-8222-222222222222";
const LEDGER_A = "33333333-3333-4333-8333-333333333333";
const LEDGER_B = "44444444-4444-4444-8444-444444444444";

function entry(overrides: Record<string, unknown>) {
  return {
    voucherId: "v-1",
    voucherNumber: "PMT-0001",
    voucherType: "PAYMENT",
    voucherDate: new Date("2026-04-15T00:00:00.000Z"),
    narration: null,
    entryType: "DEBIT",
    amount: 100,
    runningBalance: 0,
    ...overrides,
  };
}

beforeEach(() => {
  findLedgerForBalanceMock.mockReset();
  findLedgerEntriesUpToMock.mockReset();
  findLedgersForTrialBalanceMock.mockReset();
  aggregateEntriesByLedgerMock.mockReset();
  findFinancialYearMock.mockReset();
});

describe("getLedgerBalance", () => {
  it("throws when the ledger is not found", async () => {
    findLedgerForBalanceMock.mockResolvedValueOnce(null);
    await expect(getLedgerBalance(COMPANY_ID, LEDGER_A)).rejects.toThrow("Ledger not found.");
  });

  it("computes a DEBIT-opening ledger's closing balance from mixed entries", async () => {
    findLedgerForBalanceMock.mockResolvedValueOnce({ id: LEDGER_A, openingBalance: 1000, openingBalanceType: "DEBIT" });
    findLedgerEntriesUpToMock.mockResolvedValueOnce([
      entry({ entryType: "DEBIT", amount: 500 }),
      entry({ entryType: "CREDIT", amount: 200 }),
    ]);

    const result = await getLedgerBalance(COMPANY_ID, LEDGER_A);

    expect(result.totalDebit).toBe(500);
    expect(result.totalCredit).toBe(200);
    expect(result.netMovement).toBe(300);
    // opening 1000 (debit-positive) + net 300 = 1300
    expect(result.closingBalance).toBe(1300);
  });

  it("signs a CREDIT-opening ledger negative before applying net movement", async () => {
    findLedgerForBalanceMock.mockResolvedValueOnce({ id: LEDGER_A, openingBalance: 1000, openingBalanceType: "CREDIT" });
    findLedgerEntriesUpToMock.mockResolvedValueOnce([entry({ entryType: "DEBIT", amount: 300 })]);

    const result = await getLedgerBalance(COMPANY_ID, LEDGER_A);

    // opening -1000 (credit-positive stored, debit-positive sign flips it) + 300 debit = -700
    expect(result.closingBalance).toBe(-700);
  });

  it("passes asOfDate through to the repository", async () => {
    findLedgerForBalanceMock.mockResolvedValueOnce({ id: LEDGER_A, openingBalance: 0, openingBalanceType: "DEBIT" });
    findLedgerEntriesUpToMock.mockResolvedValueOnce([]);
    const asOfDate = new Date("2026-06-30T00:00:00.000Z");

    await getLedgerBalance(COMPANY_ID, LEDGER_A, asOfDate);

    expect(findLedgerEntriesUpToMock).toHaveBeenCalledWith(COMPANY_ID, LEDGER_A, asOfDate);
  });
});

describe("getLedgerStatement", () => {
  it("throws when the ledger is not found", async () => {
    findLedgerForBalanceMock.mockResolvedValueOnce(null);
    await expect(
      getLedgerStatement(COMPANY_ID, LEDGER_A, new Date("2026-04-01"), new Date("2026-04-30"))
    ).rejects.toThrow("Ledger not found.");
  });

  it("computes the opening-of-range balance from entries before `from`, and a running balance within range", async () => {
    findLedgerForBalanceMock.mockResolvedValueOnce({ id: LEDGER_A, openingBalance: 1000, openingBalanceType: "DEBIT" });
    findLedgerEntriesUpToMock.mockResolvedValueOnce([
      entry({ voucherDate: new Date("2026-04-01T00:00:00.000Z"), entryType: "DEBIT", amount: 200 }), // before range
      entry({ voucherDate: new Date("2026-04-10T00:00:00.000Z"), entryType: "CREDIT", amount: 300 }), // in range
      entry({ voucherDate: new Date("2026-04-20T00:00:00.000Z"), entryType: "DEBIT", amount: 500 }), // in range
    ]);

    const from = new Date("2026-04-05T00:00:00.000Z");
    const to = new Date("2026-04-30T00:00:00.000Z");
    const result = await getLedgerStatement(COMPANY_ID, LEDGER_A, from, to);

    // 1000 + 200 (before `from`) = 1200 opening-of-range
    expect(result.openingBalance).toBe(1200);
    expect(result.lines).toHaveLength(2);
    expect(result.lines[0].runningBalance).toBe(900); // 1200 - 300
    expect(result.lines[1].runningBalance).toBe(1400); // 900 + 500
    expect(result.closingBalance).toBe(1400);
  });

  it("fetches entries only up to `to`", async () => {
    findLedgerForBalanceMock.mockResolvedValueOnce({ id: LEDGER_A, openingBalance: 0, openingBalanceType: "DEBIT" });
    findLedgerEntriesUpToMock.mockResolvedValueOnce([]);
    const from = new Date("2026-04-01T00:00:00.000Z");
    const to = new Date("2026-04-30T00:00:00.000Z");

    await getLedgerStatement(COMPANY_ID, LEDGER_A, from, to);

    expect(findLedgerEntriesUpToMock).toHaveBeenCalledWith(COMPANY_ID, LEDGER_A, to);
  });
});

describe("getTrialBalance", () => {
  it("throws when the financial year does not exist", async () => {
    findFinancialYearMock.mockResolvedValueOnce(null);
    await expect(getTrialBalance(COMPANY_ID, FY_ID)).rejects.toThrow("Financial year not found.");
  });

  it("throws when the financial year belongs to a different company", async () => {
    findFinancialYearMock.mockResolvedValueOnce({ id: FY_ID, companyId: OTHER_COMPANY_ID, isClosed: false });
    await expect(getTrialBalance(COMPANY_ID, FY_ID)).rejects.toThrow("Financial year not found.");
  });

  it("lists every company ledger, including ones with zero activity in the year", async () => {
    findFinancialYearMock.mockResolvedValueOnce({ id: FY_ID, companyId: COMPANY_ID, isClosed: false });
    findLedgersForTrialBalanceMock.mockResolvedValueOnce([
      { id: LEDGER_A, name: "Cash", ledgerGroupId: "grp-1", openingBalance: 1000, openingBalanceType: "DEBIT" },
      { id: LEDGER_B, name: "Capital", ledgerGroupId: "grp-2", openingBalance: 1000, openingBalanceType: "CREDIT" },
    ]);
    aggregateEntriesByLedgerMock.mockResolvedValueOnce([]);

    const result = await getTrialBalance(COMPANY_ID, FY_ID);

    expect(result.rows).toHaveLength(2);
    expect(result.rows.find((r) => r.ledgerId === LEDGER_B)?.totalDebit).toBe(0);
  });

  it("balances debits and credits given a balanced opening + mixed-posting fixture", async () => {
    findFinancialYearMock.mockResolvedValueOnce({ id: FY_ID, companyId: COMPANY_ID, isClosed: false });
    // Cash (DEBIT-opening 1000) balances Capital (CREDIT-opening 1000).
    findLedgersForTrialBalanceMock.mockResolvedValueOnce([
      { id: LEDGER_A, name: "Cash", ledgerGroupId: "grp-1", openingBalance: 1000, openingBalanceType: "DEBIT" },
      { id: LEDGER_B, name: "Capital", ledgerGroupId: "grp-2", openingBalance: 1000, openingBalanceType: "CREDIT" },
    ]);
    // A Sales voucher: Cash DEBIT 300 / Capital CREDIT 300 (posted within the year).
    aggregateEntriesByLedgerMock.mockResolvedValueOnce([
      { ledgerId: LEDGER_A, entryType: "DEBIT", amount: 300 },
      { ledgerId: LEDGER_B, entryType: "CREDIT", amount: 300 },
    ]);

    const result = await getTrialBalance(COMPANY_ID, FY_ID);

    expect(result.totalDebit).toBe(result.totalCredit);
    expect(result.totalDebit).toBe(1300);
  });

  it("passes asOfDate through to the repository aggregation", async () => {
    findFinancialYearMock.mockResolvedValueOnce({ id: FY_ID, companyId: COMPANY_ID, isClosed: false });
    findLedgersForTrialBalanceMock.mockResolvedValueOnce([]);
    aggregateEntriesByLedgerMock.mockResolvedValueOnce([]);
    const asOfDate = new Date("2026-06-30T00:00:00.000Z");

    await getTrialBalance(COMPANY_ID, FY_ID, asOfDate);

    expect(aggregateEntriesByLedgerMock).toHaveBeenCalledWith(COMPANY_ID, FY_ID, asOfDate);
  });
});
