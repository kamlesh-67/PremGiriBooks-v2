-- CreateEnum
CREATE TYPE "AccountNature" AS ENUM ('ASSET', 'LIABILITY', 'INCOME', 'EXPENSE');

-- CreateTable
CREATE TABLE "LedgerGroup" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "parentGroupId" TEXT,
    "natureType" "AccountNature" NOT NULL,
    "affectsGrossProfit" BOOLEAN NOT NULL DEFAULT false,
    "isSystemDefined" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "remarks" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LedgerGroup_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "LedgerGroup_companyId_idx" ON "LedgerGroup"("companyId");

-- CreateIndex
CREATE INDEX "LedgerGroup_parentGroupId_idx" ON "LedgerGroup"("parentGroupId");

-- CreateIndex
CREATE UNIQUE INDEX "LedgerGroup_companyId_name_key" ON "LedgerGroup"("companyId", "name");

-- AddForeignKey
ALTER TABLE "LedgerGroup" ADD CONSTRAINT "LedgerGroup_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LedgerGroup" ADD CONSTRAINT "LedgerGroup_parentGroupId_fkey" FOREIGN KEY ("parentGroupId") REFERENCES "LedgerGroup"("id") ON DELETE SET NULL ON UPDATE CASCADE;
