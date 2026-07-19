import { AppError } from "@/lib/app-error";
import { isValidGstStateCode } from "@/engines/gst/state-codes";
import {
  calculateDocumentInputSchema,
  calculateLineInputSchema,
  type CalculateDocumentResult,
  type CalculateLineInput,
  type CalculateLineResult,
  type DocumentGroupResult,
  type SupplyType,
} from "@/engines/gst/types";

// Pure calculation core for the GST Engine — no I/O, no Prisma client, no
// session lookups (30-pricing-engine.md's Structure convention: "engines may
// import from modules; modules never re-implement engine logic").
//
// Every amount is converted to integer paise before any addition and
// converted back to a 2-decimal number only once, at the very end of each
// computation — the same "compare/accumulate in paise" idiom
// voucher-validation.ts's isBalanced uses. This matters here beyond style:
// summing several independently-divided 2-decimal floats does not reliably
// reproduce an exact paise-level total in IEEE754 (e.g. 0.08 + 0.07 can
// evaluate to 0.15000000000000002), so every sum below is done on integers
// first and divided by 100 exactly once.

/** `amount` is already validated to at most 2 decimal places by the Zod boundary, so this recovers the exact paise integer. */
function toPaise(amount: number): number {
  return Math.round(amount * 100);
}

/**
 * Half-up rounding of a raw (not-yet-quantized) rupee value to the nearest
 * paisa — used for tax/cess amounts computed from a rate percentage, which
 * can carry more decimal digits than the inputs before rounding
 * (33-gst-engine.md: "round the total GST tax to paise first (half-up)").
 * The 1e-9 nudge guards against a true .5-paisa boundary landing just under
 * the threshold from binary floating-point representation (e.g.
 * 12.499999999999998 instead of 12.5) — far smaller than any real rounding
 * decision at paisa resolution, so it never changes a legitimate result.
 */
function roundHalfUpToPaise(rupees: number): number {
  return Math.floor(rupees * 100 + 0.5 + 1e-9);
}

/** Place of Supply determines GST type (code-standards.md's GST Rules): equal state codes -> intra-state, otherwise inter-state. */
export function determineSupplyType(companyStateCode: string, placeOfSupplyStateCode: string): SupplyType {
  if (!isValidGstStateCode(companyStateCode)) {
    throw new AppError(`Invalid company state code: ${companyStateCode}`);
  }
  if (!isValidGstStateCode(placeOfSupplyStateCode)) {
    throw new AppError(`Invalid place of supply state code: ${placeOfSupplyStateCode}`);
  }
  return companyStateCode === placeOfSupplyStateCode ? "INTRA_STATE" : "INTER_STATE";
}

/**
 * Splits a rounded total-tax paise integer into CGST/SGST (intra-state) or
 * IGST (inter-state). Intra-state divides the ALREADY-ROUNDED total, never
 * the two halves independently — SGST takes the floor half, CGST takes the
 * remainder, so the odd paisa (when the total is odd) always lands on CGST
 * and `cgstPaise + sgstPaise === totalTaxPaise` holds by construction, not
 * by coincidence (33-gst-engine.md's intra-state split rule: two
 * independent half-up roundings could otherwise exceed the total by a
 * paisa).
 */
function splitTaxPaise(
  totalTaxPaise: number,
  supplyType: SupplyType
): { cgstPaise: number; sgstPaise: number; igstPaise: number } {
  if (supplyType === "INTER_STATE") {
    return { cgstPaise: 0, sgstPaise: 0, igstPaise: totalTaxPaise };
  }
  const sgstPaise = Math.floor(totalTaxPaise / 2);
  const cgstPaise = totalTaxPaise - sgstPaise;
  return { cgstPaise, sgstPaise, igstPaise: 0 };
}

export function calculateLine(rawInput: CalculateLineInput): CalculateLineResult {
  const input = calculateLineInputSchema.parse(rawInput);
  const isReverseCharge = input.isReverseCharge ?? false;
  const amountPaise = toPaise(input.amount);

  let totalTaxPaise: number;
  let cessPaise: number;
  let taxableAmountPaise: number;

  if (!input.isInclusive) {
    taxableAmountPaise = amountPaise;
    totalTaxPaise = roundHalfUpToPaise(input.amount * (input.ratePercent / 100));
    cessPaise = roundHalfUpToPaise(input.amount * (input.cessPercent / 100));
  } else {
    // Back-calculated taxable value from the tax-inclusive amount
    // (33-gst-engine.md's Rules). Tax and cess are rounded off THIS
    // back-calculated value, then the taxable value is redefined as the
    // residual (amount − tax − cess) — the "Inclusive residual rule" — so
    // the at-most-a-paisa rounding difference is absorbed by the taxable
    // amount instead of left dangling, and (in paise) the components always
    // foot to exactly the supplied inclusive amount.
    const combinedPercent = input.ratePercent + input.cessPercent;
    const backCalculatedTaxable = input.amount / (1 + combinedPercent / 100);
    totalTaxPaise = roundHalfUpToPaise(backCalculatedTaxable * (input.ratePercent / 100));
    cessPaise = roundHalfUpToPaise(backCalculatedTaxable * (input.cessPercent / 100));
    taxableAmountPaise = amountPaise - totalTaxPaise - cessPaise;
  }

  const { cgstPaise, sgstPaise, igstPaise } = splitTaxPaise(totalTaxPaise, input.supplyType);
  const totalAmountPaise = taxableAmountPaise + totalTaxPaise + cessPaise;

  return {
    taxableAmount: taxableAmountPaise / 100,
    cgst: cgstPaise / 100,
    sgst: sgstPaise / 100,
    igst: igstPaise / 100,
    cess: cessPaise / 100,
    totalTax: totalTaxPaise / 100,
    totalAmount: totalAmountPaise / 100,
    isReverseCharge,
  };
}

function groupKey(ratePercent: number, cessPercent: number): string {
  return `${ratePercent}::${cessPercent}`;
}

interface GroupAccumulator {
  ratePercent: number;
  cessPercent: number;
  taxableAmountPaise: number;
  cgstPaise: number;
  sgstPaise: number;
  igstPaise: number;
  cessPaise: number;
  totalTaxPaise: number;
}

/**
 * Aggregates per-line results into per-(ratePercent, cessPercent) groups
 * plus document totals. Calls `calculateLine` for every line (so each line
 * is rounded independently first), then sums the already-rounded results in
 * integer paise — "round per line, sum the rounded lines"
 * (33-gst-engine.md), so a printed invoice always foots exactly regardless
 * of how many lines it has.
 */
export function calculateDocument(rawLines: readonly CalculateLineInput[]): CalculateDocumentResult {
  const lines = calculateDocumentInputSchema.parse(rawLines);

  const groups = new Map<string, GroupAccumulator>();
  let docTaxableAmountPaise = 0;
  let docCgstPaise = 0;
  let docSgstPaise = 0;
  let docIgstPaise = 0;
  let docCessPaise = 0;
  let docTotalTaxPaise = 0;
  let docTotalAmountPaise = 0;

  for (const lineInput of lines) {
    const result = calculateLine(lineInput);
    const key = groupKey(lineInput.ratePercent, lineInput.cessPercent);
    const accumulator: GroupAccumulator = groups.get(key) ?? {
      ratePercent: lineInput.ratePercent,
      cessPercent: lineInput.cessPercent,
      taxableAmountPaise: 0,
      cgstPaise: 0,
      sgstPaise: 0,
      igstPaise: 0,
      cessPaise: 0,
      totalTaxPaise: 0,
    };

    accumulator.taxableAmountPaise += toPaise(result.taxableAmount);
    accumulator.cgstPaise += toPaise(result.cgst);
    accumulator.sgstPaise += toPaise(result.sgst);
    accumulator.igstPaise += toPaise(result.igst);
    accumulator.cessPaise += toPaise(result.cess);
    accumulator.totalTaxPaise += toPaise(result.totalTax);
    groups.set(key, accumulator);

    docTaxableAmountPaise += toPaise(result.taxableAmount);
    docCgstPaise += toPaise(result.cgst);
    docSgstPaise += toPaise(result.sgst);
    docIgstPaise += toPaise(result.igst);
    docCessPaise += toPaise(result.cess);
    docTotalTaxPaise += toPaise(result.totalTax);
    docTotalAmountPaise += toPaise(result.totalAmount);
  }

  const groupResults: DocumentGroupResult[] = [...groups.values()].map((accumulator) => ({
    ratePercent: accumulator.ratePercent,
    cessPercent: accumulator.cessPercent,
    taxableAmount: accumulator.taxableAmountPaise / 100,
    cgst: accumulator.cgstPaise / 100,
    sgst: accumulator.sgstPaise / 100,
    igst: accumulator.igstPaise / 100,
    cess: accumulator.cessPaise / 100,
    totalTax: accumulator.totalTaxPaise / 100,
  }));

  return {
    groups: groupResults,
    taxableAmount: docTaxableAmountPaise / 100,
    cgst: docCgstPaise / 100,
    sgst: docSgstPaise / 100,
    igst: docIgstPaise / 100,
    cess: docCessPaise / 100,
    totalTax: docTotalTaxPaise / 100,
    totalAmount: docTotalAmountPaise / 100,
  };
}

/**
 * "HSN Code is mandatory where applicable" (code-standards.md's GST Rules).
 * Applicable = a taxed line (33-gst-engine.md's scope decision for this
 * helper; threshold-based digit-count rules by turnover are a Phase 7
 * concern — GSTR-1 HSN Summary, #57 — not enforced here). Returns true when
 * the line still needs a code and none was supplied, so a caller can gate
 * directly: `if (isHsnRequired(isTaxedLine, line.hsnCode)) throw ...`.
 */
export function isHsnRequired(isTaxedLine: boolean, hsnCode?: string | null): boolean {
  return isTaxedLine && !hsnCode?.trim();
}
