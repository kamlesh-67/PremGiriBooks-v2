import { Prisma } from "@prisma/client";
import { describe, expect, it, vi, beforeEach } from "vitest";

// Mirrors price-list-repository.test.ts's convention — mock the Prisma
// client boundary rather than hitting a real database from a unit test.
const {
  findUniqueMock,
  findUniqueOrThrowMock,
  createMock,
  financialYearFindUniqueMock,
} = vi.hoisted(() => ({
  findUniqueMock: vi.fn(),
  findUniqueOrThrowMock: vi.fn(),
  createMock: vi.fn(),
  financialYearFindUniqueMock: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    documentSequence: {
      findUnique: (...args: unknown[]) => findUniqueMock(...args),
      findUniqueOrThrow: (...args: unknown[]) => findUniqueOrThrowMock(...args),
      create: (...args: unknown[]) => createMock(...args),
    },
    financialYear: {
      findUnique: (...args: unknown[]) => financialYearFindUniqueMock(...args),
    },
  },
}));

import { AppError } from "@/lib/app-error";
import {
  ensureSequence,
  formatNumber,
  generateNumber,
  INT4_MAX,
  previewNextNumber,
} from "@/engines/document-number/document-number-engine";

const COMPANY_ID = "11111111-1111-4111-8111-111111111111";
const OTHER_COMPANY_ID = "22222222-2222-4222-8222-222222222222";
const FY_ID = "33333333-3333-4333-8333-333333333333";
const OPEN_FY = { id: FY_ID, companyId: COMPANY_ID, isClosed: false };
const CLOSED_FY = { id: FY_ID, companyId: COMPANY_ID, isClosed: true };

function notFoundError() {
  return new Prisma.PrismaClientKnownRequestError("Record not found", {
    code: "P2025",
    clientVersion: "7.8.0",
  });
}

describe("formatNumber", () => {
  it("pads the number to the configured width", () => {
    expect(formatNumber("INV", 4, 1)).toBe("INV-0001");
  });

  it("grows naturally past the configured width instead of truncating", () => {
    expect(formatNumber("INV", 4, 10000)).toBe("INV-10000");
  });

  it("supports different prefixes and padding widths", () => {
    expect(formatNumber("SO", 6, 42)).toBe("SO-000042");
    expect(formatNumber("GRN", 1, 7)).toBe("GRN-7");
  });

  it("clamps an out-of-range stored padding instead of allocating an unbounded string", () => {
    expect(formatNumber("INV", 1_000_000, 1).length).toBeLessThan(100);
  });
});

describe("ensureSequence", () => {
  beforeEach(() => {
    findUniqueMock.mockReset();
    createMock.mockReset();
    financialYearFindUniqueMock.mockReset();
  });

  it("does nothing when a sequence row already exists", async () => {
    financialYearFindUniqueMock.mockResolvedValueOnce(OPEN_FY);
    findUniqueMock.mockResolvedValueOnce({ id: "seq-1" });

    await ensureSequence(COMPANY_ID, FY_ID, "SALES_INVOICE");

    expect(createMock).not.toHaveBeenCalled();
  });

  it("creates a row with the type's default prefix/padding on first use", async () => {
    financialYearFindUniqueMock.mockResolvedValueOnce(OPEN_FY);
    findUniqueMock.mockResolvedValueOnce(null);
    createMock.mockResolvedValueOnce({ id: "seq-1" });

    await ensureSequence(COMPANY_ID, FY_ID, "SALES_INVOICE");

    expect(createMock).toHaveBeenCalledWith({
      data: {
        companyId: COMPANY_ID,
        financialYearId: FY_ID,
        documentType: "SALES_INVOICE",
        prefix: "INV",
        padding: 4,
      },
    });
  });

  it("resolves a concurrent first-use race by re-reading the winner's row", async () => {
    financialYearFindUniqueMock.mockResolvedValueOnce(OPEN_FY);
    findUniqueMock.mockResolvedValueOnce(null);
    createMock.mockRejectedValueOnce(
      new Prisma.PrismaClientKnownRequestError("Unique constraint failed", {
        code: "P2002",
        clientVersion: "7.8.0",
      })
    );
    findUniqueMock.mockResolvedValueOnce({ id: "seq-1" });

    await expect(ensureSequence(COMPANY_ID, FY_ID, "SALES_INVOICE")).resolves.toBeUndefined();
  });

  it("rejects when the financial year is closed", async () => {
    financialYearFindUniqueMock.mockResolvedValueOnce(CLOSED_FY);

    await expect(ensureSequence(COMPANY_ID, FY_ID, "SALES_INVOICE")).rejects.toThrow(AppError);
    expect(createMock).not.toHaveBeenCalled();
  });

  it("rejects when the financial year belongs to a different company", async () => {
    financialYearFindUniqueMock.mockResolvedValueOnce(OPEN_FY);

    await expect(
      ensureSequence(OTHER_COMPANY_ID, FY_ID, "SALES_INVOICE")
    ).rejects.toThrow("Financial year not found.");
  });
});

describe("previewNextNumber", () => {
  beforeEach(() => {
    findUniqueMock.mockReset();
    findUniqueOrThrowMock.mockReset();
    createMock.mockReset();
    financialYearFindUniqueMock.mockReset();
  });

  it("previews the current nextNumber without incrementing it", async () => {
    financialYearFindUniqueMock.mockResolvedValueOnce(OPEN_FY);
    findUniqueMock.mockResolvedValueOnce({ id: "seq-1" }); // ensureSequence's existence check
    findUniqueOrThrowMock.mockResolvedValueOnce({
      id: "seq-1",
      prefix: "INV",
      padding: 4,
      nextNumber: 7,
    }); // preview read

    const result = await previewNextNumber({
      companyId: COMPANY_ID,
      financialYearId: FY_ID,
      documentType: "SALES_INVOICE",
    });

    expect(result).toEqual({ number: 7, formatted: "INV-0007" });
  });

  it("lazily creates the sequence row on first preview and previews its default nextNumber", async () => {
    financialYearFindUniqueMock.mockResolvedValueOnce(OPEN_FY);
    findUniqueMock.mockResolvedValueOnce(null); // ensureSequence's existence check: no row yet
    createMock.mockResolvedValueOnce({ id: "seq-1" }); // ensureSequence creates it
    findUniqueOrThrowMock.mockResolvedValueOnce({
      id: "seq-1",
      prefix: "INV",
      padding: 4,
      nextNumber: 1,
    }); // preview read of the just-created row

    const result = await previewNextNumber({
      companyId: COMPANY_ID,
      financialYearId: FY_ID,
      documentType: "SALES_INVOICE",
    });

    expect(createMock).toHaveBeenCalledWith({
      data: {
        companyId: COMPANY_ID,
        financialYearId: FY_ID,
        documentType: "SALES_INVOICE",
        prefix: "INV",
        padding: 4,
      },
    });
    expect(result).toEqual({ number: 1, formatted: "INV-0001" });
  });
});

describe("generateNumber", () => {
  function buildTx(overrides: { update?: ReturnType<typeof vi.fn>; findUnique?: ReturnType<typeof vi.fn> } = {}) {
    return {
      documentSequence: {
        update: overrides.update ?? vi.fn(),
        findUnique: overrides.findUnique ?? vi.fn(),
      },
      financialYear: {
        findUnique: vi.fn().mockResolvedValue(OPEN_FY),
      },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any;
  }

  it("issues the assigned number as the pre-increment value and formats it", async () => {
    const update = vi.fn().mockResolvedValueOnce({
      id: "seq-1",
      prefix: "INV",
      padding: 4,
      nextNumber: 2, // post-increment value: assigned number is 2 - 1 = 1
    });
    const tx = buildTx({ update });

    const result = await generateNumber(tx, {
      companyId: COMPANY_ID,
      financialYearId: FY_ID,
      documentType: "SALES_INVOICE",
    });

    expect(result).toEqual({ documentSequenceId: "seq-1", number: 1, formatted: "INV-0001" });
    expect(update).toHaveBeenCalledWith({
      where: {
        companyId_financialYearId_documentType: {
          companyId: COMPANY_ID,
          financialYearId: FY_ID,
          documentType: "SALES_INVOICE",
        },
        nextNumber: { lt: INT4_MAX },
      },
      data: { nextNumber: { increment: 1 } },
    });
  });

  it("rejects with a contract-violation error when ensureSequence was never called", async () => {
    const update = vi.fn().mockRejectedValueOnce(notFoundError());
    const findUnique = vi.fn().mockResolvedValueOnce(null);
    const tx = buildTx({ update, findUnique });

    await expect(
      generateNumber(tx, { companyId: COMPANY_ID, financialYearId: FY_ID, documentType: "SALES_INVOICE" })
    ).rejects.toThrow("ensureSequence must run before generateNumber");
  });

  it("rejects once the sequence has reached its documented maximum", async () => {
    const update = vi.fn().mockRejectedValueOnce(notFoundError());
    const findUnique = vi.fn().mockResolvedValueOnce({
      id: "seq-1",
      prefix: "INV",
      padding: 4,
      nextNumber: INT4_MAX,
    });
    const tx = buildTx({ update, findUnique });

    await expect(
      generateNumber(tx, { companyId: COMPANY_ID, financialYearId: FY_ID, documentType: "SALES_INVOICE" })
    ).rejects.toThrow("reached its maximum number");
  });

  it("rejects generation into a closed financial year", async () => {
    const tx = buildTx();
    tx.financialYear.findUnique.mockResolvedValueOnce(CLOSED_FY);

    await expect(
      generateNumber(tx, { companyId: COMPANY_ID, financialYearId: FY_ID, documentType: "SALES_INVOICE" })
    ).rejects.toThrow("closed financial year");
    expect(tx.documentSequence.update).not.toHaveBeenCalled();
  });

  it("rejects a financial year belonging to a different company", async () => {
    const tx = buildTx();
    tx.financialYear.findUnique.mockResolvedValueOnce(OPEN_FY);

    await expect(
      generateNumber(tx, {
        companyId: OTHER_COMPANY_ID,
        financialYearId: FY_ID,
        documentType: "SALES_INVOICE",
      })
    ).rejects.toThrow("Financial year not found.");
  });
});
