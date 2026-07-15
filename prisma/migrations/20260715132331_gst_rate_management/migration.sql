-- CreateTable
CREATE TABLE "GstRate" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "ratePercent" DECIMAL(5,2) NOT NULL,
    "cessPercent" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GstRate_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "GstRate_companyId_idx" ON "GstRate"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "GstRate_companyId_name_key" ON "GstRate"("companyId", "name");

-- AddForeignKey
ALTER TABLE "GstRate" ADD CONSTRAINT "GstRate_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
