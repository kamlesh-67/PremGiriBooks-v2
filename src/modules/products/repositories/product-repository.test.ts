import { beforeEach, describe, expect, it, vi } from "vitest";

// product-repository.ts's update() opens its own transaction via
// runInTransaction, which drives the real "@/lib/prisma" module's
// `$transaction` — mock it to hand the callback a fake tx object instead of
// hitting a real database (voucher-engine.test.ts's convention). FAKE_TX must
// be built inside vi.hoisted() since the vi.mock factory below is hoisted
// above ordinary module-scope declarations and would otherwise close over an
// uninitialized binding.
const { FAKE_TX } = vi.hoisted(() => ({
  FAKE_TX: {
    product: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    stockTransaction: {
      findFirst: vi.fn(),
    },
    unit: {
      findUnique: vi.fn(),
    },
    category: {
      findUnique: vi.fn(),
    },
    brand: {
      findUnique: vi.fn(),
    },
    hsnCode: {
      findUnique: vi.fn(),
    },
    gstRate: {
      findUnique: vi.fn(),
    },
    warehouse: {
      findUnique: vi.fn(),
    },
    marginProfile: {
      findUnique: vi.fn(),
    },
  },
}));

vi.mock("@/lib/prisma", () => ({
  prisma: { $transaction: (fn: (tx: unknown) => unknown) => fn(FAKE_TX) },
}));

import { productRepository, type ProductPersistData } from "@/modules/products/repositories/product-repository";

const COMPANY_ID = "11111111-1111-4111-8111-111111111111";
const PRODUCT_ID = "22222222-2222-4222-8222-222222222222";
const UNIT_A = "33333333-3333-4333-8333-333333333333";
const UNIT_B = "44444444-4444-4444-8444-444444444444";

const BASE_PERSIST_DATA: ProductPersistData = {
  name: "Widget",
  productCode: "WID-001",
  barcode: null,
  productType: "TRADING",
  categoryId: null,
  brandId: null,
  unitId: UNIT_A,
  hsnCodeId: null,
  gstRateId: null,
  defaultWarehouseId: null,
  marginProfileId: null,
  mrp: null,
  sellingPrice: null,
  purchasePrice: null,
  minStockLevel: null,
  description: null,
};

const EXISTING_PRODUCT = {
  id: PRODUCT_ID,
  companyId: COMPANY_ID,
  unitId: UNIT_A,
  productType: "TRADING" as const,
  categoryId: null,
  brandId: null,
  hsnCodeId: null,
  gstRateId: null,
  defaultWarehouseId: null,
  marginProfileId: null,
};

describe("productRepository.update — unitId/productType immutability once movements exist", () => {
  beforeEach(() => {
    FAKE_TX.product.findUnique.mockReset().mockResolvedValue(EXISTING_PRODUCT);
    FAKE_TX.product.update
      .mockReset()
      .mockResolvedValue({ id: PRODUCT_ID, mrp: null, sellingPrice: null, purchasePrice: null, minStockLevel: null });
    FAKE_TX.stockTransaction.findFirst.mockReset();
    FAKE_TX.unit.findUnique.mockReset();
  });

  it("rejects a unitId change once the product has a recorded stock movement", async () => {
    FAKE_TX.stockTransaction.findFirst.mockResolvedValue({ id: "txn-1" });

    await expect(
      productRepository.update(PRODUCT_ID, COMPANY_ID, { ...BASE_PERSIST_DATA, unitId: UNIT_B })
    ).rejects.toThrow("its unit and product type can no longer be changed");
    expect(FAKE_TX.product.update).not.toHaveBeenCalled();
  });

  it("rejects a productType change once the product has a recorded stock movement", async () => {
    FAKE_TX.stockTransaction.findFirst.mockResolvedValue({ id: "txn-1" });

    await expect(
      productRepository.update(PRODUCT_ID, COMPANY_ID, { ...BASE_PERSIST_DATA, productType: "SERVICE" })
    ).rejects.toThrow("its unit and product type can no longer be changed");
    expect(FAKE_TX.product.update).not.toHaveBeenCalled();
  });

  it("allows a unitId change when the product has no recorded stock movement", async () => {
    FAKE_TX.stockTransaction.findFirst.mockResolvedValue(null);
    FAKE_TX.unit.findUnique.mockResolvedValue({ id: UNIT_B, companyId: COMPANY_ID, isActive: true });

    await expect(
      productRepository.update(PRODUCT_ID, COMPANY_ID, { ...BASE_PERSIST_DATA, unitId: UNIT_B })
    ).resolves.toBeTruthy();
    expect(FAKE_TX.product.update).toHaveBeenCalled();
  });

  it("never checks for movements when neither unitId nor productType changed", async () => {
    await productRepository.update(PRODUCT_ID, COMPANY_ID, { ...BASE_PERSIST_DATA, name: "Renamed Widget" });

    expect(FAKE_TX.stockTransaction.findFirst).not.toHaveBeenCalled();
    expect(FAKE_TX.product.update).toHaveBeenCalled();
  });
});
