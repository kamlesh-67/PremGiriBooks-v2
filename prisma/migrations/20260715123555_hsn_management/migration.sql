-- CreateEnum
CREATE TYPE "HsnCodeType" AS ENUM ('HSN', 'SAC');

-- CreateTable
CREATE TABLE "HsnCode" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "codeType" "HsnCodeType" NOT NULL DEFAULT 'HSN',
    "description" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HsnCode_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "HsnCode_companyId_idx" ON "HsnCode"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "HsnCode_companyId_code_key" ON "HsnCode"("companyId", "code");

-- AddForeignKey
ALTER TABLE "HsnCode" ADD CONSTRAINT "HsnCode_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
