import { describe, expect, it } from "vitest";

import { createUnitSchema } from "@/modules/units/validation/unit-schema";

const VALID_INPUT = {
  name: "Pieces",
  symbol: "PCS",
  uqcCode: "PCS",
  decimalPlaces: 0,
  description: "Whole items",
};

describe("createUnitSchema", () => {
  it("accepts a complete valid unit and trims string fields", () => {
    const result = createUnitSchema.parse({
      ...VALID_INPUT,
      name: "  Pieces  ",
      symbol: " PCS ",
    });

    expect(result.name).toBe("Pieces");
    expect(result.symbol).toBe("PCS");
  });

  it("uppercases the UQC code", () => {
    const result = createUnitSchema.parse({ ...VALID_INPUT, uqcCode: "kgs" });
    expect(result.uqcCode).toBe("KGS");
  });

  it("normalizes a blank UQC code to undefined", () => {
    const result = createUnitSchema.parse({ ...VALID_INPUT, uqcCode: "   " });
    expect(result.uqcCode).toBeUndefined();
  });

  it("rejects a UQC code containing non-letters", () => {
    const result = createUnitSchema.safeParse({ ...VALID_INPUT, uqcCode: "PCS-1" });
    expect(result.success).toBe(false);
  });

  it("rejects decimal places outside 0-4 and non-integers", () => {
    expect(createUnitSchema.safeParse({ ...VALID_INPUT, decimalPlaces: 5 }).success).toBe(false);
    expect(createUnitSchema.safeParse({ ...VALID_INPUT, decimalPlaces: -1 }).success).toBe(false);
    expect(createUnitSchema.safeParse({ ...VALID_INPUT, decimalPlaces: 2.5 }).success).toBe(false);
    expect(createUnitSchema.safeParse({ ...VALID_INPUT, decimalPlaces: 4 }).success).toBe(true);
  });

  it("rejects a missing or too-long symbol", () => {
    expect(createUnitSchema.safeParse({ ...VALID_INPUT, symbol: "" }).success).toBe(false);
    expect(createUnitSchema.safeParse({ ...VALID_INPUT, symbol: "ABCDEFGHIJK" }).success).toBe(
      false
    );
  });

  it("accepts omitted optional fields", () => {
    const result = createUnitSchema.parse({
      name: "Kilograms",
      symbol: "KG",
      decimalPlaces: 3,
    });

    expect(result.uqcCode).toBeUndefined();
    expect(result.description).toBeUndefined();
  });
});
