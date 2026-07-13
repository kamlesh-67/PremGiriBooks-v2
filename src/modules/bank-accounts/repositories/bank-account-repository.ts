import {
  Prisma,
  type BankAccount as PrismaBankAccount,
  type BankAccountType,
  type Ledger as PrismaLedger,
  type LedgerGroup,
} from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { toLedgerWithGroup } from "@/modules/ledgers/repositories/ledger-repository";
import { isRecordNotFoundError } from "@/modules/bank-accounts/utils/prisma-errors";
import type {
  ActivateBankAccountResult,
  BankAccount,
  BankAccountListFilters,
  BankAccountWithLedger,
  DeactivateBankAccountResult,
} from "@/types/bank-account";

type PrismaClientOrTransaction = typeof prisma | Prisma.TransactionClient;

export interface BankAccountCreateData {
  bankName: string;
  accountNumber: string;
  ifscCode: string;
  branchName: string;
  accountHolderName: string;
  accountType: BankAccountType;
  upiId: string | null;
}

export type BankAccountUpdateData = BankAccountCreateData;

const LEDGER_WITH_GROUP_INCLUDE = { ledger: { include: { ledgerGroup: true } } } as const;

function toBankAccountWithLedger(
  raw: PrismaBankAccount & { ledger: PrismaLedger & { ledgerGroup: LedgerGroup } }
): BankAccountWithLedger {
  return { ...raw, ledger: toLedgerWithGroup(raw.ledger) };
}

function buildWhere(companyId: string, filters: BankAccountListFilters): Prisma.BankAccountWhereInput {
  const where: Prisma.BankAccountWhereInput = { companyId };

  if (filters.status === "active") {
    where.isActive = true;
  } else if (filters.status === "inactive") {
    where.isActive = false;
  }

  return where;
}

export const bankAccountRepository = {
  async findMany(
    companyId: string,
    filters: BankAccountListFilters = {}
  ): Promise<BankAccountWithLedger[]> {
    const rows = await prisma.bankAccount.findMany({
      where: buildWhere(companyId, filters),
      include: LEDGER_WITH_GROUP_INCLUDE,
      orderBy: { bankName: "asc" },
    });
    return rows.map(toBankAccountWithLedger);
  },

  async findById(id: string): Promise<BankAccountWithLedger | null> {
    const row = await prisma.bankAccount.findUnique({
      where: { id },
      include: LEDGER_WITH_GROUP_INCLUDE,
    });
    return row ? toBankAccountWithLedger(row) : null;
  },

  // Participates in the caller's own transaction (bankAccountService.
  // createBankAccount's), alongside the ledgerService.createUnderGroup call
  // that creates its paired Ledger row in the same unit of work — per
  // 15-bank-management.md, neither can exist without the other.
  async create(
    companyId: string,
    ledgerId: string,
    data: BankAccountCreateData,
    client: PrismaClientOrTransaction
  ): Promise<BankAccount> {
    return client.bankAccount.create({ data: { ...data, companyId, ledgerId } });
  },

  // Company-scoping is checked in the same transaction as the write — no
  // concurrent-mutation race exists (companyId is immutable), so the plain
  // isolation level the caller's transaction already runs at is sufficient.
  async update(
    id: string,
    companyId: string,
    data: BankAccountUpdateData,
    client: PrismaClientOrTransaction
  ): Promise<BankAccount | null> {
    const existing = await client.bankAccount.findUnique({ where: { id } });
    if (!existing || existing.companyId !== companyId) {
      return null;
    }

    try {
      return await client.bankAccount.update({ where: { id }, data });
    } catch (error) {
      if (isRecordNotFoundError(error)) {
        return null;
      }
      throw error;
    }
  },

  /**
   * Deactivating (and, symmetrically, activating) a Bank Account always
   * flips its own isActive together with its paired Ledger's — a Bank
   * Ledger with no active BankAccount detail (or vice versa) is an
   * inconsistent state 15-bank-management.md forbids. Writes both rows
   * directly through the interactive transaction rather than delegating to
   * ledgerRepository.activate()/deactivate() — those each open their own
   * separate transaction, which would break the "both together,
   * atomically" guarantee, and the one business rule they'd otherwise
   * re-check (blocking the change for a system-defined ledger) never
   * applies here, since a Bank Account's Ledger is never system-defined.
   */
  async activate(id: string, companyId: string): Promise<ActivateBankAccountResult> {
    return prisma.$transaction(async (tx) => {
      const existing = await tx.bankAccount.findUnique({ where: { id } });
      if (!existing || existing.companyId !== companyId) {
        return { status: "not_found" };
      }

      await tx.ledger.update({ where: { id: existing.ledgerId }, data: { isActive: true } });
      await tx.bankAccount.update({ where: { id }, data: { isActive: true } });

      const withLedger = await tx.bankAccount.findUniqueOrThrow({
        where: { id },
        include: LEDGER_WITH_GROUP_INCLUDE,
      });
      return { status: "ok", bankAccount: toBankAccountWithLedger(withLedger) };
    });
  },

  async deactivate(id: string, companyId: string): Promise<DeactivateBankAccountResult> {
    return prisma.$transaction(async (tx) => {
      const existing = await tx.bankAccount.findUnique({ where: { id } });
      if (!existing || existing.companyId !== companyId) {
        return { status: "not_found" };
      }

      await tx.ledger.update({ where: { id: existing.ledgerId }, data: { isActive: false } });
      await tx.bankAccount.update({ where: { id }, data: { isActive: false } });

      const withLedger = await tx.bankAccount.findUniqueOrThrow({
        where: { id },
        include: LEDGER_WITH_GROUP_INCLUDE,
      });
      return { status: "ok", bankAccount: toBankAccountWithLedger(withLedger) };
    });
  },
};
