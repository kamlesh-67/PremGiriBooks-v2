import { describe, expect, it, vi, beforeEach } from "vitest";

// Mocks the module-boundary repositories the engine loads through — the
// engine itself does no permission checks or session lookups (see
// pricing-engine.ts's doc comment), so its unit tests only need to verify
// the wiring: which repository calls happen, with what ids, and how the
// engine reacts to not-found/cross-company/inactive rows. The actual
// resolution logic is exhaustively covered by price-resolution.test.ts
// against the pure core directly.
const {
  productFindByIdMock,
  customerFindByIdMock,
  priceListFindByIdMock,
  priceListFindEffectiveListsMock,
  marginProfileFindByIdMock,
} = vi.hoisted(() => ({
  productFindByIdMock: vi.fn(),
  customerFindByIdMock: vi.fn(),
  priceListFindByIdMock: vi.fn(),
  priceListFindEffectiveListsMock: vi.fn(),
  marginProfileFindByIdMock: vi.fn(),
}));

vi.mock("@/modules/products/repositories/product-repository", () => ({
  productRepository: { findById: productFindByIdMock },
}));
vi.mock("@/modules/customers/repositories/customer-repository", () => ({
  customerRepository: { findById: customerFindByIdMock },
}));
vi.mock("@/modules/price-lists/repositories/price-list-repository", () => ({
  priceListRepository: {
    findById: priceListFindByIdMock,
    findEffectiveLists: priceListFindEffectiveListsMock,
  },
}));
vi.mock("@/modules/margin-profiles/repositories/margin-profile-repository", () => ({
  marginProfileRepository: { findById: marginProfileFindByIdMock },
}));

import { pricingEngine } from "@/engines/pricing/pricing-engine";

const COMPANY_ID = "11111111-1111-4111-8111-111111111111";
const OTHER_COMPANY_ID = "22222222-2222-4222-8222-222222222222";
const PRODUCT_ID = "33333333-3333-4333-8333-333333333333";
const CUSTOMER_ID = "44444444-4444-4444-8444-444444444444";

function baseProduct(overrides: Record<string, unknown> = {}) {
  return {
    id: PRODUCT_ID,
    companyId: COMPANY_ID,
    marginProfileId: null,
    purchasePrice: 100,
    sellingPrice: 90,
    isActive: true,
    unit: { id: "unit-1", name: "Piece", symbol: "pc", decimalPlaces: 2, isActive: true },
    ...overrides,
  };
}

beforeEach(() => {
  productFindByIdMock.mockReset();
  customerFindByIdMock.mockReset();
  priceListFindByIdMock.mockReset();
  priceListFindEffectiveListsMock.mockReset();
  marginProfileFindByIdMock.mockReset();
  priceListFindEffectiveListsMock.mockResolvedValue([]);
});

describe("pricingEngine.resolvePrice — loading and tenant scoping", () => {
  it("throws when the product does not exist", async () => {
    productFindByIdMock.mockResolvedValueOnce(null);

    await expect(
      pricingEngine.resolvePrice({ companyId: COMPANY_ID, productId: PRODUCT_ID, quantity: 1 })
    ).rejects.toThrow("Product not found.");
  });

  it("throws when the product belongs to a different company", async () => {
    productFindByIdMock.mockResolvedValueOnce(baseProduct({ companyId: OTHER_COMPANY_ID }));

    await expect(
      pricingEngine.resolvePrice({ companyId: COMPANY_ID, productId: PRODUCT_ID, quantity: 1 })
    ).rejects.toThrow("Product not found.");
  });

  it("rejects a quantity with more decimals than the product's unit allows", async () => {
    productFindByIdMock.mockResolvedValueOnce(
      baseProduct({ unit: { id: "u", name: "Piece", symbol: "pc", decimalPlaces: 0, isActive: true } })
    );

    await expect(
      pricingEngine.resolvePrice({ companyId: COMPANY_ID, productId: PRODUCT_ID, quantity: 1.5 })
    ).rejects.toThrow("whole number");
  });

  it("accepts a quantity honoring the unit's decimalPlaces", async () => {
    productFindByIdMock.mockResolvedValueOnce(baseProduct());

    const result = await pricingEngine.resolvePrice({
      companyId: COMPANY_ID,
      productId: PRODUCT_ID,
      quantity: 1.25,
    });

    expect(result.source).toBe("PRODUCT_DEFAULT");
  });

  it("throws when a given customerId does not exist", async () => {
    productFindByIdMock.mockResolvedValueOnce(baseProduct());
    customerFindByIdMock.mockResolvedValueOnce(null);

    await expect(
      pricingEngine.resolvePrice({
        companyId: COMPANY_ID,
        productId: PRODUCT_ID,
        quantity: 1,
        customerId: CUSTOMER_ID,
      })
    ).rejects.toThrow("Customer not found.");
  });

  it("throws when the given customer belongs to a different company", async () => {
    productFindByIdMock.mockResolvedValueOnce(baseProduct());
    customerFindByIdMock.mockResolvedValueOnce({
      id: CUSTOMER_ID,
      companyId: OTHER_COMPANY_ID,
      customerType: "RETAIL",
      priceListId: null,
    });

    await expect(
      pricingEngine.resolvePrice({
        companyId: COMPANY_ID,
        productId: PRODUCT_ID,
        quantity: 1,
        customerId: CUSTOMER_ID,
      })
    ).rejects.toThrow("Customer not found.");
  });
});

describe("pricingEngine.resolvePrice — tier defaulting end to end", () => {
  it("uses the loaded customer's own tier over an explicit customerType", async () => {
    productFindByIdMock.mockResolvedValueOnce(baseProduct());
    customerFindByIdMock.mockResolvedValueOnce({
      id: CUSTOMER_ID,
      companyId: COMPANY_ID,
      customerType: "DEALER",
      priceListId: null,
    });

    await pricingEngine.resolvePrice({
      companyId: COMPANY_ID,
      productId: PRODUCT_ID,
      quantity: 1,
      customerId: CUSTOMER_ID,
      customerType: "WHOLESALE",
    });

    expect(priceListFindEffectiveListsMock).toHaveBeenCalledWith(
      COMPANY_ID,
      expect.objectContaining({ customerType: "DEALER" })
    );
  });

  it("uses the explicit customerType when no customerId is given", async () => {
    productFindByIdMock.mockResolvedValueOnce(baseProduct());

    await pricingEngine.resolvePrice({
      companyId: COMPANY_ID,
      productId: PRODUCT_ID,
      quantity: 1,
      customerType: "DISTRIBUTOR",
    });

    expect(priceListFindEffectiveListsMock).toHaveBeenCalledWith(
      COMPANY_ID,
      expect.objectContaining({ customerType: "DISTRIBUTOR" })
    );
  });

  it("defaults to RETAIL when neither customerId nor customerType is given", async () => {
    productFindByIdMock.mockResolvedValueOnce(baseProduct());

    await pricingEngine.resolvePrice({ companyId: COMPANY_ID, productId: PRODUCT_ID, quantity: 1 });

    expect(priceListFindEffectiveListsMock).toHaveBeenCalledWith(
      COMPANY_ID,
      expect.objectContaining({ customerType: "RETAIL" })
    );
  });
});

describe("pricingEngine.resolvePrice — customer-assigned list loading", () => {
  it("resolves through the customer's assigned list when active and effective", async () => {
    productFindByIdMock.mockResolvedValueOnce(baseProduct());
    customerFindByIdMock.mockResolvedValueOnce({
      id: CUSTOMER_ID,
      companyId: COMPANY_ID,
      customerType: "RETAIL",
      priceListId: "list-1",
    });
    priceListFindByIdMock.mockResolvedValueOnce({
      id: "list-1",
      companyId: COMPANY_ID,
      customerType: "WHOLESALE",
      isActive: true,
      effectiveFrom: null,
      effectiveTo: null,
      items: [{ id: "item-1", productId: PRODUCT_ID, sellingPrice: 77, minQuantity: 1 }],
    });

    const result = await pricingEngine.resolvePrice({
      companyId: COMPANY_ID,
      productId: PRODUCT_ID,
      quantity: 1,
      customerId: CUSTOMER_ID,
    });

    expect(result).toMatchObject({ price: 77, source: "CUSTOMER_PRICE_LIST", priceListId: "list-1" });
  });

  it("ignores a cross-company assigned list (defense in depth)", async () => {
    productFindByIdMock.mockResolvedValueOnce(baseProduct());
    customerFindByIdMock.mockResolvedValueOnce({
      id: CUSTOMER_ID,
      companyId: COMPANY_ID,
      customerType: "RETAIL",
      priceListId: "list-1",
    });
    priceListFindByIdMock.mockResolvedValueOnce({
      id: "list-1",
      companyId: OTHER_COMPANY_ID,
      customerType: null,
      isActive: true,
      effectiveFrom: null,
      effectiveTo: null,
      items: [{ id: "item-1", productId: PRODUCT_ID, sellingPrice: 77, minQuantity: 1 }],
    });

    const result = await pricingEngine.resolvePrice({
      companyId: COMPANY_ID,
      productId: PRODUCT_ID,
      quantity: 1,
      customerId: CUSTOMER_ID,
    });

    expect(result.source).toBe("PRODUCT_DEFAULT");
  });

  it("ignores an inactive assigned list", async () => {
    productFindByIdMock.mockResolvedValueOnce(baseProduct());
    customerFindByIdMock.mockResolvedValueOnce({
      id: CUSTOMER_ID,
      companyId: COMPANY_ID,
      customerType: "RETAIL",
      priceListId: "list-1",
    });
    priceListFindByIdMock.mockResolvedValueOnce({
      id: "list-1",
      companyId: COMPANY_ID,
      customerType: null,
      isActive: false,
      effectiveFrom: null,
      effectiveTo: null,
      items: [{ id: "item-1", productId: PRODUCT_ID, sellingPrice: 77, minQuantity: 1 }],
    });

    const result = await pricingEngine.resolvePrice({
      companyId: COMPANY_ID,
      productId: PRODUCT_ID,
      quantity: 1,
      customerId: CUSTOMER_ID,
    });

    expect(result.source).toBe("PRODUCT_DEFAULT");
  });

  it("does not look up a price list when the customer has none assigned", async () => {
    productFindByIdMock.mockResolvedValueOnce(baseProduct());
    customerFindByIdMock.mockResolvedValueOnce({
      id: CUSTOMER_ID,
      companyId: COMPANY_ID,
      customerType: "RETAIL",
      priceListId: null,
    });

    await pricingEngine.resolvePrice({
      companyId: COMPANY_ID,
      productId: PRODUCT_ID,
      quantity: 1,
      customerId: CUSTOMER_ID,
    });

    expect(priceListFindByIdMock).not.toHaveBeenCalled();
  });
});

describe("pricingEngine.resolvePrice — margin profile loading", () => {
  it("applies the product's margin profile when active and same company", async () => {
    productFindByIdMock.mockResolvedValueOnce(baseProduct({ marginProfileId: "profile-1" }));
    marginProfileFindByIdMock.mockResolvedValueOnce({
      id: "profile-1",
      companyId: COMPANY_ID,
      isActive: true,
      calculationMode: "MARKUP",
      retailPercent: 20,
      wholesalePercent: 15,
      dealerPercent: 10,
      distributorPercent: 5,
    });

    const result = await pricingEngine.resolvePrice({
      companyId: COMPANY_ID,
      productId: PRODUCT_ID,
      quantity: 1,
    });

    expect(result).toMatchObject({ price: 120, source: "MARGIN_PROFILE", marginProfileId: "profile-1" });
  });

  it("skips an inactive margin profile, falling back to the product default", async () => {
    productFindByIdMock.mockResolvedValueOnce(baseProduct({ marginProfileId: "profile-1" }));
    marginProfileFindByIdMock.mockResolvedValueOnce({
      id: "profile-1",
      companyId: COMPANY_ID,
      isActive: false,
      calculationMode: "MARKUP",
      retailPercent: 20,
      wholesalePercent: 15,
      dealerPercent: 10,
      distributorPercent: 5,
    });

    const result = await pricingEngine.resolvePrice({
      companyId: COMPANY_ID,
      productId: PRODUCT_ID,
      quantity: 1,
    });

    expect(result.source).toBe("PRODUCT_DEFAULT");
  });

  it("skips a cross-company margin profile (defense in depth)", async () => {
    productFindByIdMock.mockResolvedValueOnce(baseProduct({ marginProfileId: "profile-1" }));
    marginProfileFindByIdMock.mockResolvedValueOnce({
      id: "profile-1",
      companyId: OTHER_COMPANY_ID,
      isActive: true,
      calculationMode: "MARKUP",
      retailPercent: 20,
      wholesalePercent: 15,
      dealerPercent: 10,
      distributorPercent: 5,
    });

    const result = await pricingEngine.resolvePrice({
      companyId: COMPANY_ID,
      productId: PRODUCT_ID,
      quantity: 1,
    });

    expect(result.source).toBe("PRODUCT_DEFAULT");
  });
});
