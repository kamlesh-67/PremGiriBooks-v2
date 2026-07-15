import { describe, expect, it } from "vitest";

import { createBrandSchema } from "@/modules/brands/validation/brand-schema";

const VALID_INPUT = {
  name: "Penguin Random House",
  description: "Trade publisher",
};

describe("createBrandSchema", () => {
  it("accepts a complete valid brand and trims string fields", () => {
    const result = createBrandSchema.parse({
      ...VALID_INPUT,
      name: "  Penguin Random House  ",
      description: "  Trade publisher  ",
    });

    expect(result.name).toBe("Penguin Random House");
    expect(result.description).toBe("Trade publisher");
  });

  it("rejects a name shorter than 2 characters or longer than 100", () => {
    expect(createBrandSchema.safeParse({ ...VALID_INPUT, name: "A" }).success).toBe(false);
    expect(createBrandSchema.safeParse({ ...VALID_INPUT, name: " A " }).success).toBe(false);
    expect(createBrandSchema.safeParse({ ...VALID_INPUT, name: "A".repeat(101) }).success).toBe(
      false
    );
    expect(createBrandSchema.safeParse({ ...VALID_INPUT, name: "A".repeat(100) }).success).toBe(
      true
    );
  });

  it("rejects a missing name", () => {
    expect(createBrandSchema.safeParse({ description: "No name" }).success).toBe(false);
  });

  it("rejects a description longer than 500 characters", () => {
    expect(
      createBrandSchema.safeParse({ ...VALID_INPUT, description: "A".repeat(501) }).success
    ).toBe(false);
    expect(
      createBrandSchema.safeParse({ ...VALID_INPUT, description: "A".repeat(500) }).success
    ).toBe(true);
  });

  it("normalizes a blank description to undefined", () => {
    const result = createBrandSchema.parse({ ...VALID_INPUT, description: "   " });
    expect(result.description).toBeUndefined();
  });

  it("accepts an omitted description", () => {
    const result = createBrandSchema.parse({ name: "Harper Collins" });
    expect(result.description).toBeUndefined();
  });
});
