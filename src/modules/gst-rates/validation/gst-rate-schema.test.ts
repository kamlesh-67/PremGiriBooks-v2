import { describe, expect, it } from "vitest";

import { createGstRateSchema } from "@/modules/gst-rates/validation/gst-rate-schema";

const VALID_INPUT = {
  name: "GST 18%",
  ratePercent: 18,
  cessPercent: 0,
  description: "Standard slab",
};

describe("createGstRateSchema", () => {
  it("accepts a complete valid rate and trims the name", () => {
    const result = createGstRateSchema.parse({ ...VALID_INPUT, name: "  GST 18%  " });

    expect(result.name).toBe("GST 18%");
    expect(result.ratePercent).toBe(18);
    expect(result.cessPercent).toBe(0);
  });

  it("accepts the statutory 0.25% slab and other 2-decimal values", () => {
    expect(createGstRateSchema.safeParse({ ...VALID_INPUT, ratePercent: 0.25 }).success).toBe(
      true
    );
    // 18.15 * 100 is not exactly representable in binary floating point —
    // guards the tolerance in hasAtMostTwoDecimals.
    expect(createGstRateSchema.safeParse({ ...VALID_INPUT, ratePercent: 18.15 }).success).toBe(
      true
    );
    expect(createGstRateSchema.safeParse({ ...VALID_INPUT, cessPercent: 12.5 }).success).toBe(
      true
    );
  });

  it("accepts the 0 and 100 boundary values", () => {
    expect(createGstRateSchema.safeParse({ ...VALID_INPUT, ratePercent: 0 }).success).toBe(true);
    expect(createGstRateSchema.safeParse({ ...VALID_INPUT, ratePercent: 100 }).success).toBe(true);
    expect(createGstRateSchema.safeParse({ ...VALID_INPUT, cessPercent: 100 }).success).toBe(true);
  });

  it("rejects values outside 0-100", () => {
    expect(createGstRateSchema.safeParse({ ...VALID_INPUT, ratePercent: -0.01 }).success).toBe(
      false
    );
    expect(createGstRateSchema.safeParse({ ...VALID_INPUT, ratePercent: 100.01 }).success).toBe(
      false
    );
    expect(createGstRateSchema.safeParse({ ...VALID_INPUT, cessPercent: -1 }).success).toBe(false);
    expect(createGstRateSchema.safeParse({ ...VALID_INPUT, cessPercent: 101 }).success).toBe(
      false
    );
  });

  it("rejects more than 2 decimal places", () => {
    expect(createGstRateSchema.safeParse({ ...VALID_INPUT, ratePercent: 0.253 }).success).toBe(
      false
    );
    expect(createGstRateSchema.safeParse({ ...VALID_INPUT, ratePercent: 18.001 }).success).toBe(
      false
    );
    expect(createGstRateSchema.safeParse({ ...VALID_INPUT, cessPercent: 1.999 }).success).toBe(
      false
    );
  });

  it("rejects a missing or non-numeric rate percent", () => {
    expect(
      createGstRateSchema.safeParse({ name: "GST 18%", cessPercent: 0 }).success
    ).toBe(false);
    expect(
      createGstRateSchema.safeParse({ ...VALID_INPUT, ratePercent: Number.NaN }).success
    ).toBe(false);
  });

  it("rejects a too-short or too-long name", () => {
    expect(createGstRateSchema.safeParse({ ...VALID_INPUT, name: "G" }).success).toBe(false);
    expect(
      createGstRateSchema.safeParse({ ...VALID_INPUT, name: "x".repeat(101) }).success
    ).toBe(false);
  });

  it("normalizes a blank description to undefined", () => {
    const result = createGstRateSchema.parse({ ...VALID_INPUT, description: "   " });
    expect(result.description).toBeUndefined();
  });

  it("accepts omitted optional fields", () => {
    const result = createGstRateSchema.parse({ name: "Exempt", ratePercent: 0 });

    expect(result.cessPercent).toBeUndefined();
    expect(result.description).toBeUndefined();
  });
});
