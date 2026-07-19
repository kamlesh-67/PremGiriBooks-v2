import type { DocumentType } from "@prisma/client";

/** Default padding for a newly-created sequence row (34-document-number-engine.md). */
export const DEFAULT_PADDING = 4;

/**
 * Per-type default prefix, applied by `ensureSequence` the first time a
 * (company, financial year, document type) triple is used. Editable
 * afterwards on the Document Numbering settings screen — this map only
 * seeds the initial row.
 */
export const DOCUMENT_TYPE_DEFAULT_PREFIXES: Record<DocumentType, string> = {
  QUOTATION: "QTN",
  SALES_ORDER: "SO",
  DELIVERY_CHALLAN: "DC",
  SALES_INVOICE: "INV",
  SALES_RETURN: "SR",
  CREDIT_NOTE: "CN",
  DEBIT_NOTE: "DN",
  PURCHASE_ORDER: "PO",
  GOODS_RECEIPT_NOTE: "GRN",
  PURCHASE_INVOICE: "PINV",
  PURCHASE_RETURN: "PR",
  PAYMENT_VOUCHER: "PMT",
  RECEIPT_VOUCHER: "RCT",
  CONTRA_VOUCHER: "CTR",
  JOURNAL_VOUCHER: "JRN",
  SALES_VOUCHER: "SV",
  PURCHASE_VOUCHER: "PV",
  CREDIT_NOTE_VOUCHER: "CNV",
  DEBIT_NOTE_VOUCHER: "DNV",
  SALES_RETURN_VOUCHER: "SRV",
  PURCHASE_RETURN_VOUCHER: "PRV",
  STOCK_ADJUSTMENT: "STKADJ",
  STOCK_TRANSFER: "STKTRF",
};

/** Human-readable labels for the settings screen's document type column. */
export const DOCUMENT_TYPE_LABELS: Record<DocumentType, string> = {
  QUOTATION: "Quotation",
  SALES_ORDER: "Sales Order",
  DELIVERY_CHALLAN: "Delivery Challan",
  SALES_INVOICE: "Sales Invoice",
  SALES_RETURN: "Sales Return",
  CREDIT_NOTE: "Credit Note",
  DEBIT_NOTE: "Debit Note",
  PURCHASE_ORDER: "Purchase Order",
  GOODS_RECEIPT_NOTE: "Goods Receipt Note",
  PURCHASE_INVOICE: "Purchase Invoice",
  PURCHASE_RETURN: "Purchase Return",
  PAYMENT_VOUCHER: "Payment Voucher",
  RECEIPT_VOUCHER: "Receipt Voucher",
  CONTRA_VOUCHER: "Contra Voucher",
  JOURNAL_VOUCHER: "Journal Voucher",
  SALES_VOUCHER: "Sales Voucher",
  PURCHASE_VOUCHER: "Purchase Voucher",
  CREDIT_NOTE_VOUCHER: "Credit Note Voucher",
  DEBIT_NOTE_VOUCHER: "Debit Note Voucher",
  SALES_RETURN_VOUCHER: "Sales Return Voucher",
  PURCHASE_RETURN_VOUCHER: "Purchase Return Voucher",
  STOCK_ADJUSTMENT: "Stock Adjustment",
  STOCK_TRANSFER: "Stock Transfer",
};
