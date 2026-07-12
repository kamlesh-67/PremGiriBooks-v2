-- Prisma's schema DSL has no partial/conditional @@unique, so this constraint
-- is hand-written directly in the migration SQL (see 09-financial-year.md
-- Business Rules: "Only one current Financial Year per company").
-- This is the authoritative, DB-level guarantee that at most one FinancialYear
-- row per company can have isCurrent = true, independent of service-layer logic.
CREATE UNIQUE INDEX "financial_year_company_current_idx" ON "FinancialYear" ("companyId") WHERE "isCurrent" = true;
