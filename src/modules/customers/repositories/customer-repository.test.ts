import { describe, expect, it, vi } from "vitest";
import type { Prisma } from "@prisma/client";

// customer-repository.ts imports the module-level `prisma` client (used by
// findMany/findById/activate/deactivate) even though create()/update() take
// their own `client` parameter — importing the real module without this
// mock throws at import time ("DATABASE_URL is not set") outside a
// configured environment, mirroring price-list-repository.test.ts's
// convention of mocking "@/lib/prisma" rather than hitting a real database.
vi.mock("@/lib/prisma", () => ({ prisma: {} }));

import { customerRepository, type CustomerPersistData } from "@/modules/customers/repositories/customer-repository";

const COMPANY_ID = "company-1";
const OTHER_COMPANY_ID = "company-2";

const BASE_PERSIST_DATA: CustomerPersistData = {
  customerType: "RETAIL",
  contactPerson: null,
  mobileNumber: null,
  alternateMobile: null,
  email: null,
  gstin: null,
  pan: null,
  addressLine1: null,
  addressLine2: null,
  city: null,
  state: null,
  district: null,
  country: "India",
  pinCode: null,
  creditLimit: null,
  creditDays: null,
  priceListId: null,
};

// customerRepository.create/update take the transaction client as an
// explicit parameter (the caller — customerService — owns the transaction),
// so a unit test can pass a minimal fake client directly rather than
// mocking the whole "@/lib/prisma" module — the price-list-repository.test.ts
// convention doesn't apply here since that repository owns its own
// runInTransaction call internally.
function fakeClient(overrides: {
  customerFindUnique?: unknown;
  customerCreate?: unknown;
  customerUpdate?: unknown;
  priceListFindUnique?: unknown;
}) {
  return {
    customer: {
      findUnique: vi.fn().mockResolvedValue(overrides.customerFindUnique ?? null),
      create: vi.fn().mockResolvedValue(overrides.customerCreate),
      update: vi.fn().mockResolvedValue(overrides.customerUpdate),
    },
    priceList: {
      findUnique: vi.fn().mockResolvedValue(overrides.priceListFindUnique ?? null),
    },
  } as unknown as Prisma.TransactionClient;
}

describe("customerRepository.create — priceListId reference verification", () => {
  it("throws when the price list does not exist", async () => {
    const client = fakeClient({ priceListFindUnique: null });

    await expect(
      customerRepository.create(
        COMPANY_ID,
        "ledger-1",
        { ...BASE_PERSIST_DATA, priceListId: "list-1" },
        client
      )
    ).rejects.toThrow("Selected price list was not found.");
  });

  it("throws when the price list belongs to a different company", async () => {
    const client = fakeClient({
      priceListFindUnique: { id: "list-1", companyId: OTHER_COMPANY_ID, isActive: true },
    });

    await expect(
      customerRepository.create(
        COMPANY_ID,
        "ledger-1",
        { ...BASE_PERSIST_DATA, priceListId: "list-1" },
        client
      )
    ).rejects.toThrow("Selected price list was not found.");
  });

  it("throws when the price list is inactive", async () => {
    const client = fakeClient({
      priceListFindUnique: { id: "list-1", companyId: COMPANY_ID, isActive: false },
    });

    await expect(
      customerRepository.create(
        COMPANY_ID,
        "ledger-1",
        { ...BASE_PERSIST_DATA, priceListId: "list-1" },
        client
      )
    ).rejects.toThrow("Selected price list is inactive.");
  });

  it("succeeds and skips verification entirely when priceListId is null", async () => {
    const client = fakeClient({
      customerCreate: { id: "customer-1", companyId: COMPANY_ID, creditLimit: null, priceList: null },
    });

    const result = await customerRepository.create(COMPANY_ID, "ledger-1", BASE_PERSIST_DATA, client);

    expect(result.priceList).toBeNull();
    expect(client.priceList.findUnique).not.toHaveBeenCalled();
  });

  it("creates the customer when the price list is active and same-company", async () => {
    const client = fakeClient({
      priceListFindUnique: { id: "list-1", companyId: COMPANY_ID, isActive: true },
      customerCreate: {
        id: "customer-1",
        companyId: COMPANY_ID,
        creditLimit: null,
        priceListId: "list-1",
        priceList: { id: "list-1", name: "Wholesale", isActive: true },
      },
    });

    const result = await customerRepository.create(
      COMPANY_ID,
      "ledger-1",
      { ...BASE_PERSIST_DATA, priceListId: "list-1" },
      client
    );

    expect(result.priceList).toEqual({ id: "list-1", name: "Wholesale", isActive: true });
  });
});

describe("customerRepository.update — priceListId reference verification", () => {
  it("does not re-verify an unchanged priceListId, even if since deactivated", async () => {
    const client = fakeClient({
      customerFindUnique: { id: "customer-1", companyId: COMPANY_ID, priceListId: "list-1" },
      customerUpdate: {
        id: "customer-1",
        companyId: COMPANY_ID,
        creditLimit: null,
        priceListId: "list-1",
        priceList: { id: "list-1", name: "Wholesale", isActive: false },
      },
    });

    const result = await customerRepository.update(
      "customer-1",
      COMPANY_ID,
      { ...BASE_PERSIST_DATA, priceListId: "list-1" },
      client
    );

    expect(result?.priceList?.isActive).toBe(false);
    expect(client.priceList.findUnique).not.toHaveBeenCalled();
  });

  it("re-verifies and rejects an inactive price list when newly assigned", async () => {
    const client = fakeClient({
      customerFindUnique: { id: "customer-1", companyId: COMPANY_ID, priceListId: null },
      priceListFindUnique: { id: "list-1", companyId: COMPANY_ID, isActive: false },
    });

    await expect(
      customerRepository.update(
        "customer-1",
        COMPANY_ID,
        { ...BASE_PERSIST_DATA, priceListId: "list-1" },
        client
      )
    ).rejects.toThrow("Selected price list is inactive.");
  });

  it("re-verifies when the assignment changes to a different list", async () => {
    const client = fakeClient({
      customerFindUnique: { id: "customer-1", companyId: COMPANY_ID, priceListId: "list-1" },
      priceListFindUnique: { id: "list-2", companyId: OTHER_COMPANY_ID, isActive: true },
    });

    await expect(
      customerRepository.update(
        "customer-1",
        COMPANY_ID,
        { ...BASE_PERSIST_DATA, priceListId: "list-2" },
        client
      )
    ).rejects.toThrow("Selected price list was not found.");
  });

  it("returns null when the customer belongs to a different company (tenant isolation)", async () => {
    const client = fakeClient({
      customerFindUnique: { id: "customer-1", companyId: OTHER_COMPANY_ID, priceListId: null },
    });

    const result = await customerRepository.update("customer-1", COMPANY_ID, BASE_PERSIST_DATA, client);

    expect(result).toBeNull();
    expect(client.priceList.findUnique).not.toHaveBeenCalled();
  });
});
