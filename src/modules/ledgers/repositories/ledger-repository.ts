import { Prisma, type Ledger as PrismaLedger, type LedgerGroup } from "@prisma/client";

import { AppError } from "@/lib/app-error";
import { prisma } from "@/lib/prisma";
import { runInTransaction } from "@/lib/transaction";
import { CASH_IN_HAND_GROUP_NAME } from "@/modules/ledger-groups/constants/default-groups";
import { isRecordNotFoundError } from "@/lib/prisma-errors";
import type {
  ActivateLedgerResult,
  DeactivateLedgerResult,
  Ledger,
  LedgerListFilters,
  LedgerWithGroup,
} from "@/types/ledger";

type PrismaClientOrTransaction = typeof prisma | Prisma.TransactionClient;

export interface LedgerCreateData {
  name: string;
  ledgerGroupId: string;
  openingBalance: number;
  openingBalanceType: PrismaLedger["openingBalanceType"];
  description: string | null;
  isSystemDefined: boolean;
}

export interface LedgerUpdateData {
  name: string;
  openingBalance: number;
  openingBalanceType: PrismaLedger["openingBalanceType"];
  description: string | null;
}

// `openingBalance` is a Prisma `Decimal` (decimal.js) instance at the
// database boundary — never serializable across a Server Component prop or
// a Server Action return value, so every read is normalized to a plain
// `number` here, before it can reach a Client Component.
function toLedger(raw: PrismaLedger): Ledger {
  return { ...raw, openingBalance: raw.openingBalance.toNumber() };
}

// Exported for reuse by 15-bank-management.md's bank-account-repository.ts,
// which needs the identical Decimal-to-number normalization for the Ledger
// nested inside a BankAccount's `include`.
export function toLedgerWithGroup(raw: PrismaLedger & { ledgerGroup: LedgerGroup }): LedgerWithGroup {
  return { ...raw, openingBalance: raw.openingBalance.toNumber() };
}

function buildWhere(companyId: string, filters: LedgerListFilters): Prisma.LedgerWhereInput {
  const where: Prisma.LedgerWhereInput = { companyId };

  if (filters.status === "active") {
    where.isActive = true;
  } else if (filters.status === "inactive") {
    where.isActive = false;
  }

  if (filters.ledgerGroupId) {
    where.ledgerGroupId = filters.ledgerGroupId;
  } else if (filters.excludeLedgerGroupIds && filters.excludeLedgerGroupIds.length > 0) {
    where.ledgerGroupId = { notIn: filters.excludeLedgerGroupIds };
  }

  if (filters.search) {
    where.name = { contains: filters.search, mode: "insensitive" };
  }

  return where;
}

export const ledgerRepository = {
  async findMany(companyId: string, filters: LedgerListFilters = {}): Promise<LedgerWithGroup[]> {
    const rows = await prisma.ledger.findMany({
      where: buildWhere(companyId, filters),
      include: { ledgerGroup: true },
      orderBy: { name: "asc" },
    });
    return rows.map(toLedgerWithGroup);
  },

  async findById(id: string): Promise<LedgerWithGroup | null> {
    const row = await prisma.ledger.findUnique({ where: { id }, include: { ledgerGroup: true } });
    return row ? toLedgerWithGroup(row) : null;
  },

  // Accepts an optional transaction client so ledgerService.seedDefaultLedger
  // and ledgerService.createUnderGroup (the shared write path
  // 15-bank-management.md, 16-expense-heads.md, and 17-income-heads.md each
  // call through) can participate in a larger atomic unit of work — defaults
  // to the plain client for the generic Create Ledger screen's
  // non-transactional caller.
  async create(
    companyId: string,
    data: LedgerCreateData,
    client: PrismaClientOrTransaction = prisma
  ): Promise<Ledger> {
    const created = await client.ledger.create({ data: { ...data, companyId } });
    return toLedger(created);
  },

  // Company-scoping and the "system-defined ledger can never be renamed"
  // rule are checked in the same transaction as the write — companyId and
  // isSystemDefined are both immutable, so no concurrent-mutation race
  // exists (mirrors ledger-group-repository.ts's update()). A same-name
  // resubmit of a system-defined ledger still succeeds; only an actual
  // rename attempt is rejected.
  //
  // Accepts an optional external transaction client, mirroring create()'s
  // identical parameter — 15-bank-management.md's bank-account-service.ts
  // calls this from inside its own prisma.$transaction so a Bank Account's
  // combined Ledger+BankAccount edit commits or rolls back as one atomic
  // unit. Defaults to opening its own transaction for every other
  // (non-transactional) caller, unchanged from before.
  async update(
    id: string,
    companyId: string,
    data: LedgerUpdateData,
    client?: Prisma.TransactionClient
  ): Promise<Ledger | null> {
    const run = async (tx: Prisma.TransactionClient) => {
      const existing = await tx.ledger.findUnique({ where: { id } });
      if (!existing || existing.companyId !== companyId) {
        return null;
      }
      if (existing.isSystemDefined && data.name !== existing.name) {
        throw new AppError('The system-defined "Cash" ledger cannot be renamed.');
      }

      try {
        const updated = await tx.ledger.update({ where: { id }, data });
        return toLedger(updated);
      } catch (error) {
        if (isRecordNotFoundError(error)) {
          return null;
        }
        throw error;
      }
    };

    return client ? run(client) : runInTransaction(run);
  },

  async activate(id: string, companyId: string): Promise<ActivateLedgerResult> {
    return runInTransaction(async (tx) => {
      const existing = await tx.ledger.findUnique({ where: { id } });
      if (!existing || existing.companyId !== companyId) {
        return { status: "not_found" };
      }

      const ledger = await tx.ledger.update({ where: { id }, data: { isActive: true } });
      return { status: "ok", ledger: toLedger(ledger) };
    });
  },

  // No count-then-write invariant exists here — a Ledger has no children the
  // way a LedgerGroup does — so no Serializable isolation/retry is needed,
  // unlike ledger-group-repository.ts's deactivate().
  async deactivate(id: string, companyId: string): Promise<DeactivateLedgerResult> {
    return runInTransaction(async (tx) => {
      const existing = await tx.ledger.findUnique({ where: { id } });
      if (!existing || existing.companyId !== companyId) {
        return { status: "not_found" };
      }
      if (existing.isSystemDefined) {
        return { status: "system_defined" };
      }

      const ledger = await tx.ledger.update({ where: { id }, data: { isActive: false } });
      return { status: "ok", ledger: toLedger(ledger) };
    });
  },

  /**
   * Seeds the single default "Cash" ledger for a brand-new company,
   * participating in the caller's own transaction (companyService.
   * createCompany()'s, immediately after 13-ledger-groups.md's own group
   * seeding in that same transaction) so a seeding failure rolls the whole
   * company creation back with it.
   */
  async seedDefault(companyId: string, tx: Prisma.TransactionClient): Promise<void> {
    const cashInHandGroup = await tx.ledgerGroup.findFirst({
      where: { companyId, name: CASH_IN_HAND_GROUP_NAME },
    });
    if (!cashInHandGroup) {
      throw new AppError(`Seed data error: "${CASH_IN_HAND_GROUP_NAME}" ledger group was not found.`);
    }

    await tx.ledger.create({
      data: {
        companyId,
        ledgerGroupId: cashInHandGroup.id,
        name: "Cash",
        openingBalance: 0,
        openingBalanceType: "DEBIT",
        isSystemDefined: true,
      },
    });
  },
};
