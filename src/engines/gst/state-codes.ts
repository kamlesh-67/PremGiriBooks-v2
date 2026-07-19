// The statutory GST state-code list (01-38) — 33-gst-engine.md's deferred
// formalization from 26-customer-management.md/27-supplier-management.md
// ("the GST Engine owns formalizing place-of-supply state codes"). Master
// `state` columns on Company/Customer/Supplier stay free text; only a
// document's explicit place of supply maps onto this list (a document-spec
// concern, not this engine's — see 33-gst-engine.md's Do Not).
//
// Codes 25/26 reflect the 2020 Union Territory merger: Daman and Diu (25)
// and Dadra and Nagar Haveli (26) became one UT, "Dadra and Nagar Haveli and
// Daman and Diu," under code 26. Code 25 is retained (not removed) so a
// company's pre-merger historical documents can still resolve their stored
// code.
//
// "96"/"97" (Other Territory / OIDAR-style foreign-supply codes) are
// deliberately NOT included — no cross-border or offshore-supply flow exists
// anywhere in this codebase yet, so adding them now would be speculative
// (YAGNI, code-standards.md). Add them the day a real caller needs one.
export interface GstStateCode {
  readonly code: string;
  readonly name: string;
}

export const GST_STATE_CODES: readonly GstStateCode[] = [
  { code: "01", name: "Jammu and Kashmir" },
  { code: "02", name: "Himachal Pradesh" },
  { code: "03", name: "Punjab" },
  { code: "04", name: "Chandigarh" },
  { code: "05", name: "Uttarakhand" },
  { code: "06", name: "Haryana" },
  { code: "07", name: "Delhi" },
  { code: "08", name: "Rajasthan" },
  { code: "09", name: "Uttar Pradesh" },
  { code: "10", name: "Bihar" },
  { code: "11", name: "Sikkim" },
  { code: "12", name: "Arunachal Pradesh" },
  { code: "13", name: "Nagaland" },
  { code: "14", name: "Manipur" },
  { code: "15", name: "Mizoram" },
  { code: "16", name: "Tripura" },
  { code: "17", name: "Meghalaya" },
  { code: "18", name: "Assam" },
  { code: "19", name: "West Bengal" },
  { code: "20", name: "Jharkhand" },
  { code: "21", name: "Odisha" },
  { code: "22", name: "Chhattisgarh" },
  { code: "23", name: "Madhya Pradesh" },
  { code: "24", name: "Gujarat" },
  { code: "25", name: "Daman and Diu (historical — merged into 26)" },
  { code: "26", name: "Dadra and Nagar Haveli and Daman and Diu" },
  { code: "27", name: "Maharashtra" },
  { code: "28", name: "Andhra Pradesh (Before Division)" },
  { code: "29", name: "Karnataka" },
  { code: "30", name: "Goa" },
  { code: "31", name: "Lakshadweep" },
  { code: "32", name: "Kerala" },
  { code: "33", name: "Tamil Nadu" },
  { code: "34", name: "Puducherry" },
  { code: "35", name: "Andaman and Nicobar Islands" },
  { code: "36", name: "Telangana" },
  { code: "37", name: "Andhra Pradesh (New)" },
  { code: "38", name: "Ladakh" },
] as const;

const GST_STATE_CODE_MAP: ReadonlyMap<string, string> = new Map(
  GST_STATE_CODES.map((entry) => [entry.code, entry.name])
);

export function isValidGstStateCode(code: string): boolean {
  return GST_STATE_CODE_MAP.has(code);
}

export function getGstStateName(code: string): string | undefined {
  return GST_STATE_CODE_MAP.get(code);
}
