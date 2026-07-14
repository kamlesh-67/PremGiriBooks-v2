-- DropForeignKey
ALTER TABLE "User" DROP CONSTRAINT "User_companyId_fkey";

-- DropForeignKey
ALTER TABLE "User" DROP CONSTRAINT "User_roleId_fkey";

-- DropIndex
DROP INDEX "Role_name_key";

-- AlterTable
ALTER TABLE "Company" ADD COLUMN     "bootstrapVersion" INTEGER NOT NULL DEFAULT 1;

-- AlterTable
ALTER TABLE "Role" ADD COLUMN     "companyId" TEXT,
ADD COLUMN     "isProtected" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "isSystemDefined" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "User" ALTER COLUMN "companyId" DROP NOT NULL,
ALTER COLUMN "roleId" DROP NOT NULL;

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "actorUserId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "targetType" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "companyId" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AuditLog_companyId_idx" ON "AuditLog"("companyId");

-- CreateIndex
CREATE INDEX "AuditLog_actorUserId_idx" ON "AuditLog"("actorUserId");

-- CreateIndex
CREATE INDEX "AuditLog_targetType_targetId_idx" ON "AuditLog"("targetType", "targetId");

-- CreateIndex
CREATE INDEX "Role_companyId_idx" ON "Role"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "Role_companyId_name_key" ON "Role"("companyId", "name");

-- DataMigration: pre-split schema had one global Role per name shared by
-- every company (companyId did not exist yet, so every existing row is
-- NULL right after the ALTER TABLE above). The per-company model requires
-- each company to own its own copy of every role, so for each existing
-- Company this clones every still-global role (copying its permission
-- grants), repoints that company's Users onto the clone, and finally
-- deletes the now-superseded global rows. A fresh/empty database has no
-- Company or companyId-NULL Role rows, so every loop body is a no-op —
-- this migration is safe to run against both a brand-new database and a
-- database carried over from before the platform/company split. Without
-- this step, the immediately-following 20260713150000_role_company_required
-- migration's `ALTER COLUMN "companyId" SET NOT NULL` aborts with
-- "column contains null values" on any database that still has
-- pre-split roles.
DO $$
DECLARE
  company_row RECORD;
  legacy_role RECORD;
  resolved_role_id TEXT;
BEGIN
  FOR company_row IN SELECT id FROM "Company" LOOP
    FOR legacy_role IN SELECT * FROM "Role" WHERE "companyId" IS NULL LOOP
      INSERT INTO "Role" (
        "id", "companyId", "name", "isSystemDefined", "isProtected",
        "isActive", "createdAt", "updatedAt"
      )
      VALUES (
        gen_random_uuid()::TEXT, company_row.id, legacy_role.name,
        legacy_role."isSystemDefined", legacy_role."isProtected",
        legacy_role."isActive", legacy_role."createdAt", now()
      )
      ON CONFLICT ("companyId", "name") DO NOTHING;

      -- Re-resolve rather than trust the id just generated: ON CONFLICT
      -- DO NOTHING means a same-named role may already exist for this
      -- company (e.g. seeded post-split), and that pre-existing row is
      -- the one permissions/users must be pointed at either way.
      SELECT id INTO resolved_role_id FROM "Role"
        WHERE "companyId" = company_row.id AND "name" = legacy_role.name;

      INSERT INTO "RolePermission" ("id", "roleId", "permissionId", "createdAt")
      SELECT gen_random_uuid()::TEXT, resolved_role_id, rp."permissionId", rp."createdAt"
      FROM "RolePermission" rp
      WHERE rp."roleId" = legacy_role.id
      ON CONFLICT ("roleId", "permissionId") DO NOTHING;

      UPDATE "User"
      SET "roleId" = resolved_role_id
      WHERE "roleId" = legacy_role.id AND "companyId" = company_row.id;
    END LOOP;
  END LOOP;

  DELETE FROM "RolePermission" WHERE "roleId" IN (SELECT id FROM "Role" WHERE "companyId" IS NULL);
  DELETE FROM "Role" WHERE "companyId" IS NULL;
END $$;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Role" ADD CONSTRAINT "Role_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;

