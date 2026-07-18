import { describe, expect, it } from "vitest";

import { createWarehouseSchema } from "@/modules/warehouses/validation/warehouse-schema";

const VALID_INPUT = {
  name: "Main Godown",
  code: "WH-MAIN",
  branchId: "0f1e2d3c-4b5a-6978-8796-a5b4c3d2e1f0",
  address: "12 Industrial Estate, Pune",
  contactNumber: "9876543210",
};

describe("createWarehouseSchema", () => {
  it("accepts a complete valid warehouse and trims name and code", () => {
    const result = createWarehouseSchema.parse({
      ...VALID_INPUT,
      name: "  Main Godown  ",
      code: "  WH-MAIN  ",
    });

    expect(result.name).toBe("Main Godown");
    expect(result.code).toBe("WH-MAIN");
    expect(result.branchId).toBe(VALID_INPUT.branchId);
  });

  it("accepts omitted optional fields (zero-branch companies are fully supported)", () => {
    const result = createWarehouseSchema.parse({ name: "Store", code: "ST" });

    expect(result.branchId).toBeUndefined();
    expect(result.address).toBeUndefined();
    expect(result.contactNumber).toBeUndefined();
  });

  it("rejects out-of-bounds name and code lengths", () => {
    expect(createWarehouseSchema.safeParse({ ...VALID_INPUT, name: "W" }).success).toBe(false);
    expect(
      createWarehouseSchema.safeParse({ ...VALID_INPUT, name: "x".repeat(101) }).success
    ).toBe(false);
    expect(createWarehouseSchema.safeParse({ ...VALID_INPUT, code: "W" }).success).toBe(false);
    expect(
      createWarehouseSchema.safeParse({ ...VALID_INPUT, code: "x".repeat(21) }).success
    ).toBe(false);
  });

  it("rejects a non-uuid branch id", () => {
    expect(
      createWarehouseSchema.safeParse({ ...VALID_INPUT, branchId: "not-a-uuid" }).success
    ).toBe(false);
  });

  it("rejects an invalid contact number and accepts a valid one", () => {
    expect(
      createWarehouseSchema.safeParse({ ...VALID_INPUT, contactNumber: "12345" }).success
    ).toBe(false);
    // Indian mobile numbers start with 6-9 (user-schema.ts's MOBILE_REGEX).
    expect(
      createWarehouseSchema.safeParse({ ...VALID_INPUT, contactNumber: "1876543210" }).success
    ).toBe(false);
    expect(
      createWarehouseSchema.safeParse({ ...VALID_INPUT, contactNumber: "6123456789" }).success
    ).toBe(true);
  });

  it("normalizes blank optional strings to undefined", () => {
    const result = createWarehouseSchema.parse({
      ...VALID_INPUT,
      address: "   ",
      contactNumber: "  ",
    });

    expect(result.address).toBeUndefined();
    expect(result.contactNumber).toBeUndefined();
  });

  it("rejects an over-long address", () => {
    expect(
      createWarehouseSchema.safeParse({ ...VALID_INPUT, address: "x".repeat(501) }).success
    ).toBe(false);
  });
});
