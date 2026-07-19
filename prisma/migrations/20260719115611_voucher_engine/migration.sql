-- CreateEnum
CREATE TYPE "VoucherType" AS ENUM ('PAYMENT', 'RECEIPT', 'CONTRA', 'JOURNAL', 'SALES', 'PURCHASE', 'CREDIT_NOTE', 'DEBIT_NOTE', 'SALES_RETURN', 'PURCHASE_RETURN');

-- CreateEnum
CREATE TYPE "VoucherStatus" AS ENUM ('POSTED', 'CANCELLED');

-- CreateTable
CREATE TABLE "Voucher" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "financialYearId" TEXT NOT NULL,
    "voucherType" "VoucherType" NOT NULL,
    "voucherNumber" TEXT NOT NULL,
    "voucherDate" DATE NOT NULL,
    "status" "VoucherStatus" NOT NULL DEFAULT 'POSTED',
    "narration" TEXT,
    "referenceType" TEXT,
    "referenceId" TEXT,
    "totalAmount" DECIMAL(14,2) NOT NULL,
    "reversalOfId" TEXT,
    "createdByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Voucher_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VoucherEntry" (
    "id" TEXT NOT NULL,
    "voucherId" TEXT NOT NULL,
    "ledgerId" TEXT NOT NULL,
    "entryType" "BalanceType" NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "lineNumber" INTEGER NOT NULL,

    CONSTRAINT "VoucherEntry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Voucher_reversalOfId_key" ON "Voucher"("reversalOfId");

-- CreateIndex
CREATE INDEX "Voucher_companyId_voucherDate_idx" ON "Voucher"("companyId", "voucherDate");

-- CreateIndex
CREATE INDEX "Voucher_companyId_voucherType_idx" ON "Voucher"("companyId", "voucherType");

-- CreateIndex
CREATE INDEX "Voucher_referenceType_referenceId_idx" ON "Voucher"("referenceType", "referenceId");

-- CreateIndex
CREATE UNIQUE INDEX "Voucher_companyId_financialYearId_voucherType_voucherNumber_key" ON "Voucher"("companyId", "financialYearId", "voucherType", "voucherNumber");

-- CreateIndex
CREATE INDEX "VoucherEntry_ledgerId_idx" ON "VoucherEntry"("ledgerId");

-- CreateIndex
CREATE INDEX "VoucherEntry_voucherId_idx" ON "VoucherEntry"("voucherId");

-- CreateIndex
CREATE UNIQUE INDEX "VoucherEntry_voucherId_lineNumber_key" ON "VoucherEntry"("voucherId", "lineNumber");

-- AddForeignKey
ALTER TABLE "Voucher" ADD CONSTRAINT "Voucher_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Voucher" ADD CONSTRAINT "Voucher_financialYearId_fkey" FOREIGN KEY ("financialYearId") REFERENCES "FinancialYear"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Voucher" ADD CONSTRAINT "Voucher_reversalOfId_fkey" FOREIGN KEY ("reversalOfId") REFERENCES "Voucher"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Voucher" ADD CONSTRAINT "Voucher_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VoucherEntry" ADD CONSTRAINT "VoucherEntry_voucherId_fkey" FOREIGN KEY ("voucherId") REFERENCES "Voucher"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VoucherEntry" ADD CONSTRAINT "VoucherEntry_ledgerId_fkey" FOREIGN KEY ("ledgerId") REFERENCES "Ledger"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
