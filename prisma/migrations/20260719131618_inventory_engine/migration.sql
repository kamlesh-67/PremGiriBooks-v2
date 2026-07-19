-- CreateEnum
CREATE TYPE "StockTransactionType" AS ENUM ('OPENING_STOCK', 'PURCHASE', 'PURCHASE_RETURN', 'SALES', 'SALES_RETURN', 'TRANSFER', 'ADJUSTMENT', 'PHYSICAL_VERIFICATION');

-- CreateEnum
CREATE TYPE "StockDirection" AS ENUM ('IN', 'OUT');

-- AlterTable
ALTER TABLE "CompanySettings" ADD COLUMN     "allowNegativeStock" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "StockTransaction" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "warehouseId" TEXT NOT NULL,
    "transactionType" "StockTransactionType" NOT NULL,
    "direction" "StockDirection" NOT NULL,
    "quantity" DECIMAL(14,4) NOT NULL,
    "unitCost" DECIMAL(14,2),
    "transactionDate" DATE NOT NULL,
    "referenceType" TEXT,
    "referenceId" TEXT,
    "transferGroupId" TEXT,
    "narration" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StockTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "StockTransaction_companyId_productId_warehouseId_idx" ON "StockTransaction"("companyId", "productId", "warehouseId");

-- CreateIndex
CREATE INDEX "StockTransaction_companyId_transactionDate_idx" ON "StockTransaction"("companyId", "transactionDate");

-- CreateIndex
CREATE INDEX "StockTransaction_referenceType_referenceId_idx" ON "StockTransaction"("referenceType", "referenceId");

-- CreateIndex
CREATE INDEX "StockTransaction_transferGroupId_idx" ON "StockTransaction"("transferGroupId");

-- AddForeignKey
ALTER TABLE "StockTransaction" ADD CONSTRAINT "StockTransaction_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockTransaction" ADD CONSTRAINT "StockTransaction_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockTransaction" ADD CONSTRAINT "StockTransaction_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "Warehouse"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
