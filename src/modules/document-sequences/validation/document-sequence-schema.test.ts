import { describe, expect, it } from "vitest";

import { updateDocumentSequenceSchema } from "@/modules/document-sequences/validation/document-sequence-schema";

describe("updateDocumentSequenceSchema", () => {
  it("trims and uppercases the prefix", () => {
    const result = updateDocumentSequenceSchema.parse({ prefix: " inv ", padding: 4 });
    expect(result.prefix).toBe("INV");
  });

  it("accepts / and - characters in the prefix", () => {
    const result = updateDocumentSequenceSchema.parse({ prefix: "INV/25-26", padding: 4 });
    expect(result.prefix).toBe("INV/25-26");
  });

  it("rejects an empty or too-long prefix", () => {
    expect(updateDocumentSequenceSchema.safeParse({ prefix: "", padding: 4 }).success).toBe(false);
    expect(
      updateDocumentSequenceSchema.safeParse({ prefix: "ABCDEFGHIJK", padding: 4 }).success
    ).toBe(false);
  });

  it("rejects characters outside the allowed set", () => {
    expect(updateDocumentSequenceSchema.safeParse({ prefix: "INV#1", padding: 4 }).success).toBe(
      false
    );
  });

  it("rejects padding outside 1-8 or non-integers", () => {
    expect(updateDocumentSequenceSchema.safeParse({ prefix: "INV", padding: 0 }).success).toBe(
      false
    );
    expect(updateDocumentSequenceSchema.safeParse({ prefix: "INV", padding: 9 }).success).toBe(
      false
    );
    expect(updateDocumentSequenceSchema.safeParse({ prefix: "INV", padding: 2.5 }).success).toBe(
      false
    );
    expect(updateDocumentSequenceSchema.safeParse({ prefix: "INV", padding: 8 }).success).toBe(
      true
    );
  });

  it("rejects a prefix/padding combination exceeding the 16-character GST bound", () => {
    // 10 + 1 + 8 = 19 > 16
    expect(
      updateDocumentSequenceSchema.safeParse({ prefix: "ABCDEFGHIJ", padding: 8 }).success
    ).toBe(false);
    // 7 + 1 + 8 = 16, exactly at the bound
    expect(
      updateDocumentSequenceSchema.safeParse({ prefix: "ABCDEFG", padding: 8 }).success
    ).toBe(true);
  });
});
