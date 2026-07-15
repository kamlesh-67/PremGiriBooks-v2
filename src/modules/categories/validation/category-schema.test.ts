import { describe, expect, it } from "vitest";

import { createCategorySchema } from "@/modules/categories/validation/category-schema";

const VALID_INPUT = {
  name: "Notebooks",
  parentCategoryId: "3f0a2b1c-4d5e-4f60-8a9b-0c1d2e3f4a5b",
  description: "Ruled and plain notebooks",
};

describe("createCategorySchema", () => {
  it("accepts a complete valid category and trims string fields", () => {
    const result = createCategorySchema.parse({
      ...VALID_INPUT,
      name: "  Notebooks  ",
      description: " Ruled and plain notebooks ",
    });

    expect(result.name).toBe("Notebooks");
    expect(result.description).toBe("Ruled and plain notebooks");
  });

  it("accepts omitted optional fields", () => {
    const result = createCategorySchema.parse({ name: "Stationery" });

    expect(result.parentCategoryId).toBeUndefined();
    expect(result.description).toBeUndefined();
  });

  it("rejects a too-short or too-long name", () => {
    expect(createCategorySchema.safeParse({ name: "A" }).success).toBe(false);
    expect(createCategorySchema.safeParse({ name: "A".repeat(101) }).success).toBe(false);
    expect(createCategorySchema.safeParse({ name: "A".repeat(100) }).success).toBe(true);
  });

  it("rejects a non-uuid parent category id", () => {
    const result = createCategorySchema.safeParse({
      ...VALID_INPUT,
      parentCategoryId: "not-a-uuid",
    });
    expect(result.success).toBe(false);
  });

  it("normalizes a blank description to undefined", () => {
    const result = createCategorySchema.parse({ ...VALID_INPUT, description: "   " });
    expect(result.description).toBeUndefined();
  });

  it("rejects a description longer than 500 characters", () => {
    const result = createCategorySchema.safeParse({
      ...VALID_INPUT,
      description: "A".repeat(501),
    });
    expect(result.success).toBe(false);
  });
});
