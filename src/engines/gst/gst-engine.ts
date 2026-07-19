import { calculateDocument, calculateLine, determineSupplyType, isHsnRequired } from "@/engines/gst/gst-calculation";

export { calculateDocument, calculateLine, determineSupplyType, isHsnRequired };
export { getGstStateName, GST_STATE_CODES, isValidGstStateCode, type GstStateCode } from "@/engines/gst/state-codes";
export type {
  CalculateDocumentInput,
  CalculateDocumentResult,
  CalculateLineInput,
  CalculateLineResult,
  DocumentGroupResult,
  SupplyType,
} from "@/engines/gst/types";

/** Public API surface for every future taxed document (Sales/Purchase Invoice, Credit/Debit Notes, returns) — 33-gst-engine.md. */
export const gstEngine = {
  determineSupplyType,
  calculateLine,
  calculateDocument,
  isHsnRequired,
};
