import { describe, expect, it } from "vitest";

import { createSupplierSchema } from "@/modules/suppliers/validation/supplier-schema";

const GROUP_ID = "0f1e2d3c-4b5a-6978-8796-a5b4c3d2e1f0";

const VALID_INPUT = {
  displayName: "Sharma Paper Traders",
  ledgerGroupId: GROUP_ID,
  contactPerson: "Ramesh Sharma",
  mobileNumber: "9876543210",
  alternateMobile: "8765432109",
  email: "ramesh@sharmapaper.in",
  gstin: "27AAPFU0939F1ZV",
  pan: "AAPFU0939F",
  addressLine1: "12 MG Road",
  addressLine2: "Near City Mall",
  city: "Pune",
  state: "Maharashtra",
  district: "Pune",
  country: "India",
  pinCode: "411001",
  creditDays: 30,
  openingBalance: 0,
  openingBalanceType: "CREDIT",
  description: "Wholesale paper supplier since 2020",
};

describe("createSupplierSchema", () => {
  it("accepts a complete valid supplier and trims text fields", () => {
    const result = createSupplierSchema.parse({
      ...VALID_INPUT,
      displayName: "  Sharma Paper Traders  ",
      contactPerson: "  Ramesh Sharma  ",
      city: "  Pune  ",
    });

    expect(result.displayName).toBe("Sharma Paper Traders");
    expect(result.contactPerson).toBe("Ramesh Sharma");
    expect(result.city).toBe("Pune");
    expect(result.creditDays).toBe(30);
  });

  it("accepts the minimal field set — only display name, group, and opening balance are required", () => {
    const result = createSupplierSchema.parse({
      displayName: "Walk-up Vendor",
      ledgerGroupId: GROUP_ID,
      openingBalance: 0,
      openingBalanceType: "CREDIT",
    });

    expect(result.contactPerson).toBeUndefined();
    expect(result.mobileNumber).toBeUndefined();
    expect(result.email).toBeUndefined();
    expect(result.gstin).toBeUndefined();
    expect(result.pan).toBeUndefined();
    expect(result.creditDays).toBeUndefined();
  });

  it("rejects out-of-bounds display names and requires a uuid ledger group", () => {
    expect(createSupplierSchema.safeParse({ ...VALID_INPUT, displayName: "S" }).success).toBe(
      false
    );
    expect(
      createSupplierSchema.safeParse({ ...VALID_INPUT, displayName: "x".repeat(101) }).success
    ).toBe(false);
    expect(
      createSupplierSchema.safeParse({ ...VALID_INPUT, ledgerGroupId: "not-a-uuid" }).success
    ).toBe(false);
  });

  it("uppercases GSTIN and PAN before validating their formats", () => {
    const result = createSupplierSchema.parse({
      ...VALID_INPUT,
      gstin: "27aapfu0939f1zv",
      pan: "aapfu0939f",
    });

    expect(result.gstin).toBe("27AAPFU0939F1ZV");
    expect(result.pan).toBe("AAPFU0939F");
    expect(createSupplierSchema.safeParse({ ...VALID_INPUT, gstin: "INVALID" }).success).toBe(
      false
    );
    expect(createSupplierSchema.safeParse({ ...VALID_INPUT, pan: "1234567890" }).success).toBe(
      false
    );
  });

  it("normalizes blank optional fields to undefined", () => {
    const result = createSupplierSchema.parse({
      ...VALID_INPUT,
      contactPerson: "   ",
      mobileNumber: "",
      gstin: "  ",
      pan: "",
      addressLine1: "  ",
      pinCode: "",
      description: "   ",
    });

    expect(result.contactPerson).toBeUndefined();
    expect(result.mobileNumber).toBeUndefined();
    expect(result.gstin).toBeUndefined();
    expect(result.pan).toBeUndefined();
    expect(result.addressLine1).toBeUndefined();
    expect(result.pinCode).toBeUndefined();
    expect(result.description).toBeUndefined();
  });

  it("validates mobile numbers, email, and PIN code formats when present", () => {
    // Indian mobile numbers start with 6-9 (validation-patterns.ts's MOBILE_REGEX).
    expect(
      createSupplierSchema.safeParse({ ...VALID_INPUT, mobileNumber: "1234567890" }).success
    ).toBe(false);
    expect(
      createSupplierSchema.safeParse({ ...VALID_INPUT, alternateMobile: "98765" }).success
    ).toBe(false);
    expect(createSupplierSchema.safeParse({ ...VALID_INPUT, email: "not-an-email" }).success).toBe(
      false
    );
    expect(createSupplierSchema.safeParse({ ...VALID_INPUT, pinCode: "0123456" }).success).toBe(
      false
    );
    expect(createSupplierSchema.safeParse({ ...VALID_INPUT, pinCode: "411001" }).success).toBe(
      true
    );
  });

  it("bounds credit days to whole numbers between 0 and 365", () => {
    expect(createSupplierSchema.safeParse({ ...VALID_INPUT, creditDays: -1 }).success).toBe(false);
    expect(createSupplierSchema.safeParse({ ...VALID_INPUT, creditDays: 30.5 }).success).toBe(
      false
    );
    expect(createSupplierSchema.safeParse({ ...VALID_INPUT, creditDays: 366 }).success).toBe(
      false
    );
    expect(createSupplierSchema.safeParse({ ...VALID_INPUT, creditDays: 0 }).success).toBe(true);
    expect(createSupplierSchema.safeParse({ ...VALID_INPUT, creditDays: 365 }).success).toBe(true);
  });

  it("rejects a negative opening balance, more than 2 decimal places, and an unknown balance type", () => {
    expect(createSupplierSchema.safeParse({ ...VALID_INPUT, openingBalance: -1 }).success).toBe(
      false
    );
    expect(
      createSupplierSchema.safeParse({ ...VALID_INPUT, openingBalance: 10.999 }).success
    ).toBe(false);
    expect(
      createSupplierSchema.safeParse({ ...VALID_INPUT, openingBalance: 18.15 }).success
    ).toBe(true);
    expect(
      createSupplierSchema.safeParse({ ...VALID_INPUT, openingBalanceType: "BOTH" }).success
    ).toBe(false);
    expect(
      createSupplierSchema.safeParse({ ...VALID_INPUT, openingBalanceType: "DEBIT" }).success
    ).toBe(true);
  });

  it("has no supplierType or creditLimit fields", () => {
    const result = createSupplierSchema.parse(VALID_INPUT);
    expect(result).not.toHaveProperty("supplierType");
    expect(result).not.toHaveProperty("creditLimit");
  });
});
