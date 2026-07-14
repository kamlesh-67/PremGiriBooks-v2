import { Prisma, type FinancialYear } from "@prisma/client";

import { AppError } from "@/lib/app-error";
import { prisma } from "@/lib/prisma";
import { runInTransaction } from "@/lib/transaction";
import type { FinancialYearPersistData } from "@/modules/financial-year/utils/normalize-financial-year-input";
import {
  isRecordNotFoundError,
  isRetryableTransactionError,
} from "@/modules/financial-year/utils/prisma-errors";
import type { CloseFinancialYearResult } from "@/types/financial-year";

export const OVERLAP_ERROR_MESSAGE =
  "This date range overlaps an existing financial year for this company.";

const SERIALIZABLE_RETRY = {
  isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
  retryable: isRetryableTransactionError,
  conflictMessage: "The financial year was changed by another request. Please try again.",
};

export const financialYearRepository = {
  findMany(companyId: string): Promise<FinancialYear[]> {
    return prisma.financialYear.findMany({
      where: { companyId },
      orderBy: { startDate: "desc" },
    });
  },

  findById(id: string): Promise<FinancialYear | null> {
    return prisma.financialYear.findUnique({ where: { id } });
  },

  /**
   * Checks for an overlapping date range and inserts inside one Serializable
   * transaction, so two concurrent creates for overlapping ranges can't both
   * pass the check — Postgres's write-skew detection aborts one with a
   * serialization failure (retried), and the retry sees the other's
   * now-committed row and correctly rejects it.
   */
  create(companyId: string, data: FinancialYearPersistData): Promise<FinancialYear> {
    return runInTransaction(async (tx) => {
      const overlapping = await tx.financialYear.findMany({
        where: { companyId, startDate: { lte: data.endDate }, endDate: { gte: data.startDate } },
      });
      if (overlapping.length > 0) {
        throw new AppError(OVERLAP_ERROR_MESSAGE);
      }

      return tx.financialYear.create({ data: { ...data, companyId } });
    }, SERIALIZABLE_RETRY);
  },

  update(
    id: string,
    companyId: string,
    data: FinancialYearPersistData
  ): Promise<FinancialYear | null> {
    return runInTransaction(async (tx) => {
      const overlapping = await tx.financialYear.findMany({
        where: {
          companyId,
          id: { not: id },
          startDate: { lte: data.endDate },
          endDate: { gte: data.startDate },
        },
      });
      if (overlapping.length > 0) {
        throw new AppError(OVERLAP_ERROR_MESSAGE);
      }

      try {
        return await tx.financialYear.update({ where: { id }, data });
      } catch (error) {
        if (isRecordNotFoundError(error)) {
          return null;
        }
        throw error;
      }
    }, SERIALIZABLE_RETRY);
  },

  setCurrent(companyId: string, id: string): Promise<FinancialYear> {
    return runInTransaction(async (tx) => {
      await tx.financialYear.updateMany({
        where: { companyId, isCurrent: true },
        data: { isCurrent: false },
      });
      return tx.financialYear.update({ where: { id }, data: { isCurrent: true } });
    }, SERIALIZABLE_RETRY);
  },

  close(companyId: string, id: string): Promise<CloseFinancialYearResult> {
    return runInTransaction(async (tx) => {
      const target = await tx.financialYear.findUniqueOrThrow({ where: { id } });
      const wasCurrent = target.isCurrent;

      const closedYear = await tx.financialYear.update({
        where: { id },
        data: { isClosed: true, isCurrent: false },
      });

      if (!wasCurrent) {
        return { financialYear: closedYear, wasCurrent: false, promotedFinancialYearId: null };
      }

      const otherOpenYears = await tx.financialYear.findMany({
        where: { companyId, isClosed: false, id: { not: id } },
      });

      if (otherOpenYears.length === 1) {
        const promoted = await tx.financialYear.update({
          where: { id: otherOpenYears[0].id },
          data: { isCurrent: true },
        });
        return {
          financialYear: closedYear,
          wasCurrent: true,
          promotedFinancialYearId: promoted.id,
        };
      }

      return { financialYear: closedYear, wasCurrent: true, promotedFinancialYearId: null };
    }, SERIALIZABLE_RETRY);
  },
};
