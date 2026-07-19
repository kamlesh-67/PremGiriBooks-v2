import { describe, expect, it } from "vitest";

import { getGstStateName, GST_STATE_CODES, isValidGstStateCode } from "@/engines/gst/state-codes";

describe("GST_STATE_CODES", () => {
  it("has exactly 38 entries, codes 01-38", () => {
    expect(GST_STATE_CODES).toHaveLength(38);
    const codes = GST_STATE_CODES.map((entry) => entry.code).sort();
    const expected = Array.from({ length: 38 }, (_, i) => String(i + 1).padStart(2, "0")).sort();
    expect(codes).toEqual(expected);
  });

  it("has no duplicate codes", () => {
    const codes = GST_STATE_CODES.map((entry) => entry.code);
    expect(new Set(codes).size).toBe(codes.length);
  });

  it("includes the merged DNH&DD union territory at 26", () => {
    expect(getGstStateName("26")).toBe("Dadra and Nagar Haveli and Daman and Diu");
  });

  it("includes Lakshadweep at 31 and Ladakh at 38", () => {
    expect(getGstStateName("31")).toBe("Lakshadweep");
    expect(getGstStateName("38")).toBe("Ladakh");
  });
});

describe("isValidGstStateCode", () => {
  it.each(["01", "09", "27", "38"])("accepts a valid statutory code %s", (code) => {
    expect(isValidGstStateCode(code)).toBe(true);
  });

  it.each(["00", "39", "96", "97", "", "1", "ABC"])("rejects an out-of-range or malformed code %s", (code) => {
    expect(isValidGstStateCode(code)).toBe(false);
  });
});
