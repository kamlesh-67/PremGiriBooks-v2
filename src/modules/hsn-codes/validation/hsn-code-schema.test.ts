import { describe, expect, it } from "vitest";

import { createHsnCodeSchema } from "@/modules/hsn-codes/validation/hsn-code-schema";

const VALID_HSN_INPUT = {
  code: "4901",
  codeType: "HSN",
  description: "Printed books",
};

const VALID_SAC_INPUT = {
  code: "998599",
  codeType: "SAC",
  description: "Other support services",
};

describe("createHsnCodeSchema", () => {
  it("accepts a valid HSN code and trims string fields", () => {
    const result = createHsnCodeSchema.parse({
      ...VALID_HSN_INPUT,
      code: "  4901  ",
      description: "  Printed books  ",
    });

    expect(result.code).toBe("4901");
    expect(result.codeType).toBe("HSN");
    expect(result.description).toBe("Printed books");
  });

  it("accepts HSN codes of exactly 4, 6, or 8 digits and rejects other lengths", () => {
    expect(createHsnCodeSchema.safeParse({ ...VALID_HSN_INPUT, code: "4901" }).success).toBe(true);
    expect(createHsnCodeSchema.safeParse({ ...VALID_HSN_INPUT, code: "490110" }).success).toBe(
      true
    );
    expect(createHsnCodeSchema.safeParse({ ...VALID_HSN_INPUT, code: "49011010" }).success).toBe(
      true
    );

    expect(createHsnCodeSchema.safeParse({ ...VALID_HSN_INPUT, code: "490" }).success).toBe(false);
    expect(createHsnCodeSchema.safeParse({ ...VALID_HSN_INPUT, code: "49011" }).success).toBe(
      false
    );
    expect(createHsnCodeSchema.safeParse({ ...VALID_HSN_INPUT, code: "4901101" }).success).toBe(
      false
    );
    expect(createHsnCodeSchema.safeParse({ ...VALID_HSN_INPUT, code: "490110101" }).success).toBe(
      false
    );
  });

  it("accepts a SAC code of exactly 6 digits and rejects other lengths", () => {
    expect(createHsnCodeSchema.safeParse(VALID_SAC_INPUT).success).toBe(true);

    expect(createHsnCodeSchema.safeParse({ ...VALID_SAC_INPUT, code: "9985" }).success).toBe(
      false
    );
    expect(createHsnCodeSchema.safeParse({ ...VALID_SAC_INPUT, code: "99859910" }).success).toBe(
      false
    );
  });

  it("rejects non-digit input for the code", () => {
    expect(createHsnCodeSchema.safeParse({ ...VALID_HSN_INPUT, code: "49A1" }).success).toBe(
      false
    );
    expect(createHsnCodeSchema.safeParse({ ...VALID_HSN_INPUT, code: "4901-10" }).success).toBe(
      false
    );
    expect(createHsnCodeSchema.safeParse({ ...VALID_HSN_INPUT, code: "" }).success).toBe(false);
  });

  it("rejects an invalid code type", () => {
    expect(
      createHsnCodeSchema.safeParse({ ...VALID_HSN_INPUT, codeType: "GOODS" }).success
    ).toBe(false);
  });

  it("requires a description of 2-200 characters", () => {
    expect(
      createHsnCodeSchema.safeParse({ ...VALID_HSN_INPUT, description: undefined }).success
    ).toBe(false);
    expect(createHsnCodeSchema.safeParse({ ...VALID_HSN_INPUT, description: "  " }).success).toBe(
      false
    );
    expect(createHsnCodeSchema.safeParse({ ...VALID_HSN_INPUT, description: "A" }).success).toBe(
      false
    );
    expect(
      createHsnCodeSchema.safeParse({ ...VALID_HSN_INPUT, description: "B".repeat(201) }).success
    ).toBe(false);
    expect(
      createHsnCodeSchema.safeParse({ ...VALID_HSN_INPUT, description: "B".repeat(200) }).success
    ).toBe(true);
  });
});
