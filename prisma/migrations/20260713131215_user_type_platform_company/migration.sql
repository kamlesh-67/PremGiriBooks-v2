-- CreateEnum
CREATE TYPE "UserType" AS ENUM ('PLATFORM', 'COMPANY');

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "userType" "UserType" NOT NULL DEFAULT 'COMPANY';

-- CreateIndex
CREATE INDEX "User_userType_idx" ON "User"("userType");
