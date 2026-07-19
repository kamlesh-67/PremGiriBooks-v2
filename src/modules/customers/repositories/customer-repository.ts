import {
  Prisma,
  type Customer as PrismaCustomer,
  type CustomerType,
  type Ledger as PrismaLedger,
  type LedgerGroup,
} from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { isRecordNotFoundError } from "@/lib/prisma-errors";
import { toLedgerWithGroup } from "@/modules/ledgers/repositories/ledger-repository";
import type {
  ActivateCustomerResult,
  Customer,
  CustomerListFilters,
  CustomerWithLedger,
  DeactivateCustomerResult,
} from "@/types/customer";

type PrismaClientOrTransaction = typeof prisma | Prisma.TransactionClient;

export interface CustomerPersistData {
  customerType: CustomerType;
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
  creditLimit: number | null;
  creditDays: number | null;
}

const LEDGER_WITH_GROUP_INCLUDE = { ledger: { include: { ledgerGroup: true } } } as const;

// `creditLimit` is a Prisma `Decimal` at the database boundary — normalized
// to a plain `number` here, before it can cross the Server Component /
// Server Action serialization boundary (the Ledger.openingBalance/GstRate
// convention). The nested Ledger reuses toLedgerWithGroup for the identical
// normalization of its own openingBalance.
function toCustomer(raw: PrismaCustomer): Customer {
  return { ...raw, creditLimit: raw.creditLimit === null ? null : raw.creditLimit.toNumber() };
}

function toCustomerWithLedger(
  raw: PrismaCustomer & { ledger: PrismaLedger & { ledgerGroup: LedgerGroup } }
): CustomerWithLedger {
  return { ...toCustomer(raw), ledger: toLedgerWithGroup(raw.ledger) };
}

function buildWhere(companyId: string, filters: CustomerListFilters): Prisma.CustomerWhereInput {
  const where: Prisma.CustomerWhereInput = { companyId };

  if (filters.status === "active") {
    where.isActive = true;
  } else if (filters.status === "inactive") {
    where.isActive = false;
  }

  if (filters.customerType) {
    where.customerType = filters.customerType;
  }

  if (filters.search) {
    // Search covers the ledger (display) name, mobile number, and GSTIN —
    // the three fields a billing screen will look a customer up by
    // (26-customer-management.md).
    where.OR = [
      { ledger: { name: { contains: filters.search, mode: "insensitive" } } },
      { mobileNumber: { contains: filters.search, mode: "insensitive" } },
      { gstin: { contains: filters.search, mode: "insensitive" } },
    ];
  }

  return where;
}

// Shared body for activate()/deactivate() below — flips isActive on the
// Customer's paired Ledger and on the Customer row itself against the
// caller-supplied client, so the caller (customerService) folds this into
// its own transaction. There is no way to toggle just one half — the
// bank-management invariant verbatim (26-customer-management.md).
async function setCustomerActive(
  id: string,
  companyId: string,
  isActive: boolean,
  client: PrismaClientOrTransaction
): Promise<ActivateCustomerResult | DeactivateCustomerResult> {
  const existing = await client.customer.findUnique({ where: { id } });
  if (!existing || existing.companyId !== companyId) {
    return { status: "not_found" };
  }

  await client.ledger.update({ where: { id: existing.ledgerId }, data: { isActive } });
  const updated = await client.customer.update({
    where: { id },
    data: { isActive },
    include: LEDGER_WITH_GROUP_INCLUDE,
  });

  return { status: "ok", customer: toCustomerWithLedger(updated) };
}

export const customerRepository = {
  async findMany(
    companyId: string,
    filters: CustomerListFilters = {}
  ): Promise<CustomerWithLedger[]> {
    const rows = await prisma.customer.findMany({
      where: buildWhere(companyId, filters),
      include: LEDGER_WITH_GROUP_INCLUDE,
      orderBy: { ledger: { name: "asc" } },
    });
    return rows.map(toCustomerWithLedger);
  },

  async findById(id: string): Promise<CustomerWithLedger | null> {
    const row = await prisma.customer.findUnique({
      where: { id },
      include: LEDGER_WITH_GROUP_INCLUDE,
    });
    return row ? toCustomerWithLedger(row) : null;
  },

  // Participates in the caller's own transaction (customerService.
  // createCustomer's), alongside the ledgerService.createUnderGroup call
  // that creates its paired Ledger row in the same unit of work — per
  // 26-customer-management.md, neither can exist without the other.
  async create(
    companyId: string,
    ledgerId: string,
    data: CustomerPersistData,
    client: PrismaClientOrTransaction
  ): Promise<Customer> {
    const created = await client.customer.create({ data: { ...data, companyId, ledgerId } });
    return toCustomer(created);
  },

  // Company-scoping is checked in the same transaction as the write — no
  // concurrent-mutation race exists (companyId is immutable), so the plain
  // isolation level the caller's transaction already runs at is sufficient
  // (the bank-account-repository.ts shape).
  async update(
    id: string,
    companyId: string,
    data: CustomerPersistData,
    client: PrismaClientOrTransaction
  ): Promise<Customer | null> {
    const existing = await client.customer.findUnique({ where: { id } });
    if (!existing || existing.companyId !== companyId) {
      return null;
    }

    try {
      const updated = await client.customer.update({ where: { id }, data });
      return toCustomer(updated);
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
  ): Promise<ActivateCustomerResult> {
    return setCustomerActive(id, companyId, true, client);
  },

  async deactivate(
    id: string,
    companyId: string,
    client: PrismaClientOrTransaction = prisma
  ): Promise<DeactivateCustomerResult> {
    return setCustomerActive(id, companyId, false, client);
  },
};
