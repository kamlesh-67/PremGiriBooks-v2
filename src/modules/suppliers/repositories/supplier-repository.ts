import {
  Prisma,
  type Supplier as PrismaSupplier,
  type Ledger as PrismaLedger,
  type LedgerGroup,
} from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { isRecordNotFoundError } from "@/lib/prisma-errors";
import { toLedgerWithGroup } from "@/modules/ledgers/repositories/ledger-repository";
import type {
  ActivateSupplierResult,
  DeactivateSupplierResult,
  Supplier,
  SupplierListFilters,
  SupplierWithLedger,
} from "@/types/supplier";

type PrismaClientOrTransaction = typeof prisma | Prisma.TransactionClient;

export interface SupplierPersistData {
  contactPerson: string | null;
  mobileNumber: string | null;
  alternateMobile: string | null;
  email: string | null;
  gstin: string | null;
  pan: string | null;
  addressLine1: string | null;
  addressLine2: string | null;
  city: string | null;
  state: string | null;
  district: string | null;
  country: string;
  pinCode: string | null;
  creditDays: number | null;
}

const LEDGER_WITH_GROUP_INCLUDE = { ledger: { include: { ledgerGroup: true } } } as const;

function toSupplierWithLedger(
  raw: PrismaSupplier & { ledger: PrismaLedger & { ledgerGroup: LedgerGroup } }
): SupplierWithLedger {
  return { ...raw, ledger: toLedgerWithGroup(raw.ledger) };
}

function buildWhere(companyId: string, filters: SupplierListFilters): Prisma.SupplierWhereInput {
  const where: Prisma.SupplierWhereInput = { companyId };

  if (filters.status === "active") {
    where.isActive = true;
  } else if (filters.status === "inactive") {
    where.isActive = false;
  }

  if (filters.search) {
    // Search covers the ledger (display) name, mobile number, and GSTIN —
    // the same three fields customer-repository.ts's buildWhere covers
    // (27-supplier-management.md).
    where.OR = [
      { ledger: { name: { contains: filters.search, mode: "insensitive" } } },
      { mobileNumber: { contains: filters.search, mode: "insensitive" } },
      { gstin: { contains: filters.search, mode: "insensitive" } },
    ];
  }

  return where;
}

// Shared body for activate()/deactivate() below — flips isActive on the
// Supplier's paired Ledger and on the Supplier row itself against the
// caller-supplied client, so the caller (supplierService) folds this into
// its own transaction. There is no way to toggle just one half — the
// customer/bank-management invariant verbatim (27-supplier-management.md).
async function setSupplierActive(
  id: string,
  companyId: string,
  isActive: boolean,
  client: PrismaClientOrTransaction
): Promise<ActivateSupplierResult | DeactivateSupplierResult> {
  const existing = await client.supplier.findUnique({ where: { id } });
  if (!existing || existing.companyId !== companyId) {
    return { status: "not_found" };
  }

  await client.ledger.update({ where: { id: existing.ledgerId }, data: { isActive } });
  const updated = await client.supplier.update({
    where: { id },
    data: { isActive },
    include: LEDGER_WITH_GROUP_INCLUDE,
  });

  return { status: "ok", supplier: toSupplierWithLedger(updated) };
}

export const supplierRepository = {
  async findMany(
    companyId: string,
    filters: SupplierListFilters = {}
  ): Promise<SupplierWithLedger[]> {
    const rows = await prisma.supplier.findMany({
      where: buildWhere(companyId, filters),
      include: LEDGER_WITH_GROUP_INCLUDE,
      orderBy: { ledger: { name: "asc" } },
    });
    return rows.map(toSupplierWithLedger);
  },

  async findById(id: string): Promise<SupplierWithLedger | null> {
    const row = await prisma.supplier.findUnique({
      where: { id },
      include: LEDGER_WITH_GROUP_INCLUDE,
    });
    return row ? toSupplierWithLedger(row) : null;
  },

  // Participates in the caller's own transaction (supplierService.
  // createSupplier's), alongside the ledgerService.createUnderGroup call
  // that creates its paired Ledger row in the same unit of work — per
  // 27-supplier-management.md, neither can exist without the other.
  async create(
    companyId: string,
    ledgerId: string,
    data: SupplierPersistData,
    client: PrismaClientOrTransaction
  ): Promise<Supplier> {
    return client.supplier.create({ data: { ...data, companyId, ledgerId } });
  },

  // Company-scoping is checked in the same transaction as the write — no
  // concurrent-mutation race exists (companyId is immutable), so the plain
  // isolation level the caller's transaction already runs at is sufficient
  // (the customer-repository.ts shape).
  async update(
    id: string,
    companyId: string,
    data: SupplierPersistData,
    client: PrismaClientOrTransaction
  ): Promise<Supplier | null> {
    const existing = await client.supplier.findUnique({ where: { id } });
    if (!existing || existing.companyId !== companyId) {
      return null;
    }

    try {
      return await client.supplier.update({ where: { id }, data });
    } catch (error) {
      if (isRecordNotFoundError(error)) {
        return null;
      }
      throw error;
    }
  },

  async activate(
    id: string,
    companyId: string,
    client: PrismaClientOrTransaction = prisma
  ): Promise<ActivateSupplierResult> {
    return setSupplierActive(id, companyId, true, client);
  },

  async deactivate(
    id: string,
    companyId: string,
    client: PrismaClientOrTransaction = prisma
  ): Promise<DeactivateSupplierResult> {
    return setSupplierActive(id, companyId, false, client);
  },
};
