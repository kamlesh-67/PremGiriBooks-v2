import { describe, expect, it } from "vitest";

import { createProductSchema } from "@/modules/products/validation/product-schema";

const UNIT_ID = "0f1e2d3c-4b5a-6978-8796-a5b4c3d2e1f0";
const REF_ID = "a1b2c3d4-e5f6-7788-99aa-bbccddeeff00";

const VALID_INPUT = {
  name: "Premium Notebook A4",
  productCode: "NB-A4-200",
  barcode: "8901234567890",
  productType: "TRADING",
  categoryId: REF_ID,
  brandId: REF_ID,
  unitId: UNIT_ID,
  hsnCodeId: REF_ID,
  gstRateId: REF_ID,
  defaultWarehouseId: REF_ID,
  mrp: 250,
  sellingPrice: 199.99,
  purchasePrice: 150.5,
  minStockLevel: 10.25,
  description: "200-page ruled notebook",
};

describe("createProductSchema", () => {
  it("accepts a complete valid product and trims text fields", () => {
    const result = createProductSchema.parse({
      ...VALID_INPUT,
      name: "  Premium Notebook A4  ",
      productCode: "  NB-A4-200  ",
      barcode: "  8901234567890  ",
    });

    expect(result.name).toBe("Premium Notebook A4");
    expect(result.productCode).toBe("NB-A4-200");
    expect(result.barcode).toBe("8901234567890");
    expect(result.productType).toBe("TRADING");
    expect(result.sellingPrice).toBe(199.99);
  });

  it("accepts the minimal field set — only name, code, type, and unit are required", () => {
    const result = createProductSchema.parse({
      name: "Consulting",
      productCode: "SRV-01",
      productType: "SERVICE",
      unitId: UNIT_ID,
    });

    expect(result.barcode).toBeUndefined();
    expect(result.categoryId).toBeUndefined();
    expect(result.brandId).toBeUndefined();
    expect(result.hsnCodeId).toBeUndefined();
    expect(result.gstRateId).toBeUndefined();
    expect(result.defaultWarehouseId).toBeUndefined();
    expect(result.mrp).toBeUndefined();
    expect(result.minStockLevel).toBeUndefined();
    expect(result.description).toBeUndefined();
  });

  it("accepts all three product types and rejects FORMULA (reserved for a future release)", () => {
    for (const productType of ["TRADING", "SERVICE", "EXPENSE"]) {
      expect(createProductSchema.safeParse({ ...VALID_INPUT, productType }).success).toBe(true);
    }
    expect(createProductSchema.safeParse({ ...VALID_INPUT, productType: "FORMULA" }).success).toBe(
      false
    );
  });

  it("rejects out-of-bounds name and product code lengths", () => {
    expect(createProductSchema.safeParse({ ...VALID_INPUT, name: "P" }).success).toBe(false);
    expect(createProductSchema.safeParse({ ...VALID_INPUT, name: "x".repeat(201) }).success).toBe(
      false
    );
    expect(createProductSchema.safeParse({ ...VALID_INPUT, productCode: "P" }).success).toBe(false);
    expect(
      createProductSchema.safeParse({ ...VALID_INPUT, productCode: "x".repeat(51) }).success
    ).toBe(false);
  });

  it("normalizes a blank barcode to undefined and bounds its length", () => {
    expect(createProductSchema.parse({ ...VALID_INPUT, barcode: "   " }).barcode).toBeUndefined();
    expect(createProductSchema.safeParse({ ...VALID_INPUT, barcode: "123" }).success).toBe(false);
    expect(
      createProductSchema.safeParse({ ...VALID_INPUT, barcode: "1".repeat(51) }).success
    ).toBe(false);
    expect(createProductSchema.safeParse({ ...VALID_INPUT, barcode: "1234" }).success).toBe(true);
  });

  it("requires a uuid unit and rejects non-uuid reference ids", () => {
    expect(createProductSchema.safeParse({ ...VALID_INPUT, unitId: undefined }).success).toBe(
      false
    );
    expect(createProductSchema.safeParse({ ...VALID_INPUT, unitId: "" }).success).toBe(false);
    for (const field of [
      "categoryId",
      "brandId",
      "hsnCodeId",
      "gstRateId",
      "defaultWarehouseId",
    ]) {
      expect(
        createProductSchema.safeParse({ ...VALID_INPUT, [field]: "not-a-uuid" }).success
      ).toBe(false);
    }
  });

  it("rejects negative prices and more than 2 decimal places (Decimal(14,2) storage limit)", () => {
    for (const field of ["mrp", "sellingPrice", "purchasePrice"]) {
      expect(createProductSchema.safeParse({ ...VALID_INPUT, [field]: -1 }).success).toBe(false);
      expect(createProductSchema.safeParse({ ...VALID_INPUT, [field]: 10.999 }).success).toBe(
        false
      );
      // 18.15 * 100 === 1814.9999… in binary floats — a legitimate 2-decimal
      // value must still pass (the scaled-with-tolerance check).
      expect(createProductSchema.safeParse({ ...VALID_INPUT, [field]: 18.15 }).success).toBe(true);
      expect(createProductSchema.safeParse({ ...VALID_INPUT, [field]: 0 }).success).toBe(true);
    }
  });

  it("bounds minStockLevel to 4 decimal places (Decimal(14,4) storage limit)", () => {
    expect(createProductSchema.safeParse({ ...VALID_INPUT, minStockLevel: -1 }).success).toBe(
      false
    );
    expect(
      createProductSchema.safeParse({ ...VALID_INPUT, minStockLevel: 1.00001 }).success
    ).toBe(false);
    expect(createProductSchema.safeParse({ ...VALID_INPUT, minStockLevel: 1.0001 }).success).toBe(
      true
    );
  });

  it("normalizes a blank description to undefined and bounds its length", () => {
    expect(
      createProductSchema.parse({ ...VALID_INPUT, description: "   " }).description
    ).toBeUndefined();
    expect(
      createProductSchema.safeParse({ ...VALID_INPUT, description: "x".repeat(1001) }).success
    ).toBe(false);
  });
});
