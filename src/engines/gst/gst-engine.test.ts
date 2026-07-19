import { describe, expect, it } from "vitest";

import { gstEngine } from "@/engines/gst/gst-engine";

// Composition test: determineSupplyType's output feeds calculateDocument's
// per-line supplyType, exactly how a future Sales Invoice (#36) would call
// this engine — company state vs. the invoice's place of supply decides the
// split for every line on the document (33-gst-engine.md's Success
// Criteria).
describe("gstEngine — composition", () => {
  const MAHARASHTRA = "27";
  const KARNATAKA = "29";

  function invoiceLines(supplyType: "INTRA_STATE" | "INTER_STATE") {
    return [
      // A trading good taxed at 18%, priced exclusive of tax.
      { amount: 2500, isInclusive: false, ratePercent: 18, cessPercent: 0, supplyType },
      // A second line at the same slab — should fold into the same group.
      { amount: 1500, isInclusive: false, ratePercent: 18, cessPercent: 0, supplyType },
      // A luxury item with cess, MRP-style inclusive pricing.
      { amount: 1180, isInclusive: true, ratePercent: 18, cessPercent: 5, supplyType },
    ] as const;
  }

  it("resolves to INTRA_STATE for a same-state sale and splits every line into CGST/SGST", () => {
    const supplyType = gstEngine.determineSupplyType(MAHARASHTRA, MAHARASHTRA);
    expect(supplyType).toBe("INTRA_STATE");

    const document = gstEngine.calculateDocument(invoiceLines(supplyType));

    expect(document.igst).toBe(0);
    expect(document.cgst).toBeGreaterThan(0);
    expect(document.sgst).toBe(document.cgst);
    // Every group's tax type matches the resolved supply type.
    for (const group of document.groups) {
      expect(group.igst).toBe(0);
    }
    // Document totals foot exactly (paise-level comparison, this codebase's
    // established convention for exact money comparisons).
    const summedPaise = Math.round((document.taxableAmount + document.totalTax + document.cess) * 100);
    expect(Math.round(document.totalAmount * 100)).toBe(summedPaise);
  });

  it("resolves to INTER_STATE for a cross-state sale and routes every line to IGST", () => {
    const supplyType = gstEngine.determineSupplyType(MAHARASHTRA, KARNATAKA);
    expect(supplyType).toBe("INTER_STATE");

    const document = gstEngine.calculateDocument(invoiceLines(supplyType));

    expect(document.cgst).toBe(0);
    expect(document.sgst).toBe(0);
    expect(document.igst).toBeGreaterThan(0);
    for (const group of document.groups) {
      expect(group.cgst).toBe(0);
      expect(group.sgst).toBe(0);
    }
  });

  it("produces identical total tax liability regardless of supply type (only the split changes)", () => {
    const intraDocument = gstEngine.calculateDocument(invoiceLines("INTRA_STATE"));
    const interDocument = gstEngine.calculateDocument(invoiceLines("INTER_STATE"));

    expect(intraDocument.totalTax).toBe(interDocument.totalTax);
    expect(intraDocument.totalAmount).toBe(interDocument.totalAmount);
    expect(intraDocument.cgst + intraDocument.sgst).toBeCloseTo(interDocument.igst, 6);
  });

  it("exposes the full public API surface (state codes, calculation functions, HSN helper)", () => {
    expect(gstEngine.determineSupplyType).toBeTypeOf("function");
    expect(gstEngine.calculateLine).toBeTypeOf("function");
    expect(gstEngine.calculateDocument).toBeTypeOf("function");
    expect(gstEngine.isHsnRequired).toBeTypeOf("function");
  });
});
