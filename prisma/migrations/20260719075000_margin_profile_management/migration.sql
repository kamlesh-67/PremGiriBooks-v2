-- CreateEnum
CREATE TYPE "PriceCalculationMode" AS ENUM ('MARGIN', 'MARKUP');

-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "marginProfileId" TEXT;

-- CreateTable
CREATE TABLE "MarginProfile" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "calculationMode" "PriceCalculationMode" NOT NULL DEFAULT 'MARGIN',
    "retailPercent" DECIMAL(5,2) NOT NULL,
    "wholesalePercent" DECIMAL(5,2) NOT NULL,
    "dealerPercent" DECIMAL(5,2) NOT NULL,
    "distributorPercent" DECIMAL(5,2) NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MarginProfile_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MarginProfile_companyId_idx" ON "MarginProfile"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "MarginProfile_companyId_name_key" ON "MarginProfile"("companyId", "name");

-- CreateIndex
CREATE INDEX "Product_marginProfileId_idx" ON "Product"("marginProfileId");

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_marginProfileId_fkey" FOREIGN KEY ("marginProfileId") REFERENCES "MarginProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarginProfile" ADD CONSTRAINT "MarginProfile_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

