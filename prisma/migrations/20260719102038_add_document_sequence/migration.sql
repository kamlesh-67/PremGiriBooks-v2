-- CreateEnum
CREATE TYPE "DocumentType" AS ENUM ('QUOTATION', 'SALES_ORDER', 'DELIVERY_CHALLAN', 'SALES_INVOICE', 'SALES_RETURN', 'CREDIT_NOTE', 'DEBIT_NOTE', 'PURCHASE_ORDER', 'GOODS_RECEIPT_NOTE', 'PURCHASE_INVOICE', 'PURCHASE_RETURN', 'PAYMENT_VOUCHER', 'RECEIPT_VOUCHER', 'CONTRA_VOUCHER', 'JOURNAL_VOUCHER', 'SALES_VOUCHER', 'PURCHASE_VOUCHER', 'CREDIT_NOTE_VOUCHER', 'DEBIT_NOTE_VOUCHER', 'SALES_RETURN_VOUCHER', 'PURCHASE_RETURN_VOUCHER', 'STOCK_ADJUSTMENT', 'STOCK_TRANSFER');

-- CreateTable
CREATE TABLE "DocumentSequence" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "financialYearId" TEXT NOT NULL,
    "documentType" "DocumentType" NOT NULL,
    "prefix" TEXT NOT NULL,
    "padding" INTEGER NOT NULL DEFAULT 4,
    "nextNumber" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DocumentSequence_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DocumentSequence_companyId_idx" ON "DocumentSequence"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "DocumentSequence_companyId_financialYearId_documentType_key" ON "DocumentSequence"("companyId", "financialYearId", "documentType");

-- AddForeignKey
ALTER TABLE "DocumentSequence" ADD CONSTRAINT "DocumentSequence_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentSequence" ADD CONSTRAINT "DocumentSequence_financialYearId_fkey" FOREIGN KEY ("financialYearId") REFERENCES "FinancialYear"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
