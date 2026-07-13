-- CreateEnum
CREATE TYPE "BalanceType" AS ENUM ('DEBIT', 'CREDIT');

-- CreateTable
CREATE TABLE "Ledger" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "ledgerGroupId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "openingBalance" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "openingBalanceType" "BalanceType" NOT NULL DEFAULT 'DEBIT',
    "description" TEXT,
    "isSystemDefined" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Ledger_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Ledger_companyId_idx" ON "Ledger"("companyId");

-- CreateIndex
CREATE INDEX "Ledger_ledgerGroupId_idx" ON "Ledger"("ledgerGroupId");

-- CreateIndex
CREATE UNIQUE INDEX "Ledger_companyId_name_key" ON "Ledger"("companyId", "name");

-- AddForeignKey
ALTER TABLE "Ledger" ADD CONSTRAINT "Ledger_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Ledger" ADD CONSTRAINT "Ledger_ledgerGroupId_fkey" FOREIGN KEY ("ledgerGroupId") REFERENCES "LedgerGroup"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
