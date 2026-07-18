-- Composite tenant-safe FK (review fix, 2026-07-18): replace the
-- single-column Warehouse->Branch FK with (companyId, branchId) ->
-- Branch(companyId, id), so the database itself rejects a cross-company
-- branch link (defense-in-depth behind the repository's
-- assertAssignableBranch check). MATCH SIMPLE semantics keep branchId NULL
-- (the zero-branch company case) fully supported. ON DELETE RESTRICT is
-- Prisma's emission for a composite FK containing a required column — fine,
-- branches are never deleted anywhere in this codebase.

-- DropForeignKey
ALTER TABLE "Warehouse" DROP CONSTRAINT "Warehouse_branchId_fkey";

-- CreateIndex
CREATE UNIQUE INDEX "Branch_companyId_id_key" ON "Branch"("companyId", "id");

-- AddForeignKey
ALTER TABLE "Warehouse" ADD CONSTRAINT "Warehouse_companyId_branchId_fkey" FOREIGN KEY ("companyId", "branchId") REFERENCES "Branch"("companyId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
