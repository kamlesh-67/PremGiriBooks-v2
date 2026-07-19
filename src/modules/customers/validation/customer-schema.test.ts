import { describe, expect, it } from "vitest";

import { createCustomerSchema } from "@/modules/customers/validation/customer-schema";

const GROUP_ID = "0f1e2d3c-4b5a-6978-8796-a5b4c3d2e1f0";

const VALID_INPUT = {
  displayName: "Sharma Book Depot",
  ledgerGroupId: GROUP_ID,
  customerType: "WHOLESALE",
  contactPerson: "Ramesh Sharma",
  mobileNumber: "9876543210",
  alternateMobile: "8765432109",
  email: "ramesh@sharmabooks.in",
  gstin: "27AAPFU0939F1ZV",
  pan: "AAPFU0939F",
  addressLine1: "12 MG Road",
  addressLine2: "Near City Mall",
  city: "Pune",
  state: "Maharashtra",
  district: "Pune",
  country: "India",
  pinCode: "411001",
  creditLimit: 50000,
  creditDays: 30,
  openingBalance: 0,
  openingBalanceType: "DEBIT",
  description: "Wholesale buyer since 2020",
};

describe("createCustomerSchema", () => {
  it("accepts a complete valid customer and trims text fields", () => {
    const result = createCustomerSchema.parse({
      ...VALID_INPUT,
      displayName: "  Sharma Book Depot  ",
      contactPerson: "  Ramesh Sharma  ",
      city: "  Pune  ",
    });

    expect(result.displayName).toBe("Sharma Book Depot");
    expect(result.contactPerson).toBe("Ramesh Sharma");
    expect(result.city).toBe("Pune");
    expect(result.customerType).toBe("WHOLESALE");
    expect(result.creditLimit).toBe(50000);
  });

  it("accepts the minimal field set — only display name, group, type, and opening balance are required", () => {
    const result = createCustomerSchema.parse({
      displayName: "Walk-up Trader",
      ledgerGroupId: GROUP_ID,
      customerType: "RETAIL",
      openingBalance: 0,
      openingBalanceType: "DEBIT",
    });

    expect(result.contactPerson).toBeUndefined();
    expect(result.mobileNumber).toBeUndefined();
    expect(result.email).toBeUndefined();
    expect(result.gstin).toBeUndefined();
    expect(result.pan).toBeUndefined();
    expect(result.creditLimit).toBeUndefined();
    expect(result.creditDays).toBeUndefined();
  });

  it("accepts all four customer types and rejects unknown values", () => {
    for (const customerType of ["RETAIL", "WHOLESALE", "DEALER", "DISTRIBUTOR"]) {
      expect(createCustomerSchema.safeParse({ ...VALID_INPUT, customerType }).success).toBe(true);
    }
    expect(createCustomerSchema.safeParse({ ...VALID_INPUT, customerType: "VIP" }).success).toBe(
      false
    );
  });

  it("rejects out-of-bounds display names and requires a uuid ledger group", () => {
    expect(createCustomerSchema.safeParse({ ...VALID_INPUT, displayName: "S" }).success).toBe(
      false
    );
    expect(
      createCustomerSchema.safeParse({ ...VALID_INPUT, displayName: "x".repeat(101) }).success
    ).toBe(false);
    expect(
      createCustomerSchema.safeParse({ ...VALID_INPUT, ledgerGroupId: "not-a-uuid" }).success
    ).toBe(false);
  });

  it("uppercases GSTIN and PAN before validating their formats", () => {
    const result = createCustomerSchema.parse({
      ...VALID_INPUT,
      gstin: "27aapfu0939f1zv",
      pan: "aapfu0939f",
    });

    expect(result.gstin).toBe("27AAPFU0939F1ZV");
    expect(result.pan).toBe("AAPFU0939F");
    expect(createCustomerSchema.safeParse({ ...VALID_INPUT, gstin: "INVALID" }).success).toBe(
      false
    );
    expect(createCustomerSchema.safeParse({ ...VALID_INPUT, pan: "1234567890" }).success).toBe(
      false
    );
  });

  it("normalizes blank optional fields to undefined", () => {
    const result = createCustomerSchema.parse({
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
      createCustomerSchema.safeParse({ ...VALID_INPUT, mobileNumber: "1234567890" }).success
    ).toBe(false);
    expect(
      createCustomerSchema.safeParse({ ...VALID_INPUT, alternateMobile: "98765" }).success
    ).toBe(false);
    expect(createCustomerSchema.safeParse({ ...VALID_INPUT, email: "not-an-email" }).success).toBe(
      false
    );
    expect(createCustomerSchema.safeParse({ ...VALID_INPUT, pinCode: "0123456" }).success).toBe(
      false
    );
    expect(createCustomerSchema.safeParse({ ...VALID_INPUT, pinCode: "411001" }).success).toBe(
      true
    );
  });

  it("rejects negative credit limits and more than 2 decimal places (Decimal(14,2) storage limit)", () => {
    expect(createCustomerSchema.safeParse({ ...VALID_INPUT, creditLimit: -1 }).success).toBe(
      false
    );
    expect(createCustomerSchema.safeParse({ ...VALID_INPUT, creditLimit: 10.999 }).success).toBe(
      false
    );
    // 18.15 * 100 === 1814.9999… in binary floats — a legitimate 2-decimal
    // value must still pass (the scaled-with-tolerance check).
    expect(createCustomerSchema.safeParse({ ...VALID_INPUT, creditLimit: 18.15 }).success).toBe(
      true
    );
    expect(createCustomerSchema.safeParse({ ...VALID_INPUT, creditLimit: 0 }).success).toBe(true);
  });

  it("accepts an omitted priceListId and rejects a malformed one", () => {
    expect(createCustomerSchema.safeParse(VALID_INPUT).success).toBe(true);
    expect(
      createCustomerSchema.safeParse({ ...VALID_INPUT, priceListId: "not-a-uuid" }).success
    ).toBe(false);
    const result = createCustomerSchema.parse({
      ...VALID_INPUT,
      priceListId: "3fa85f64-5717-4562-b3fc-2c963f66afa6",
    });
    expect(result.priceListId).toBe("3fa85f64-5717-4562-b3fc-2c963f66afa6");
  });

  it("bounds credit days to whole numbers between 0 and 365", () => {
    expect(createCustomerSchema.safeParse({ ...VALID_INPUT, creditDays: -1 }).success).toBe(false);
    expect(createCustomerSchema.safeParse({ ...VALID_INPUT, creditDays: 30.5 }).success).toBe(
      false
    );
    expect(createCustomerSchema.safeParse({ ...VALID_INPUT, creditDays: 366 }).success).toBe(
      false
    );
    expect(createCustomerSchema.safeParse({ ...VALID_INPUT, creditDays: 0 }).success).toBe(true);
    expect(createCustomerSchema.safeParse({ ...VALID_INPUT, creditDays: 365 }).success).toBe(true);
  });

  it("rejects a negative opening balance, more than 2 decimal places, and an unknown balance type", () => {
    expect(createCustomerSchema.safeParse({ ...VALID_INPUT, openingBalance: -1 }).success).toBe(
      false
    );
    expect(
      createCustomerSchema.safeParse({ ...VALID_INPUT, openingBalance: 10.999 }).success
    ).toBe(false);
    expect(
      createCustomerSchema.safeParse({ ...VALID_INPUT, openingBalance: 18.15 }).success
    ).toBe(true);
    expect(
      createCustomerSchema.safeParse({ ...VALID_INPUT, openingBalanceType: "BOTH" }).success
    ).toBe(false);
    expect(
      createCustomerSchema.safeParse({ ...VALID_INPUT, openingBalanceType: "CREDIT" }).success
    ).toBe(true);
  });
});
