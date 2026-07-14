import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { hashPassword } from "../src/lib/password";
import { prisma as sharedPrisma } from "../src/lib/prisma";
import { permissionService } from "../src/modules/roles/services/permission-service";
import { tenantBootstrapService } from "../src/modules/administration/services/tenant-bootstrap-service";

// 07-authentication.md explicitly excludes a registration screen, so the
// very first Super Admin and the first company's Company Admin must be
// bootstrapped here. These default passwords are a local-development
// convenience only — production-like environments must set
// SEED_SUPER_ADMIN_PASSWORD/SEED_ADMIN_PASSWORD explicitly (enforced below)
// rather than relying on them.
const DEFAULT_SEED_SUPER_ADMIN_PASSWORD = "SuperAdmin@12345";
const DEFAULT_SEED_ADMIN_PASSWORD = "Admin@12345";

const DEFAULT_FINANCIAL_YEAR = {
  name: "2026-2027",
  startDate: "2026-04-01",
  endDate: "2027-03-31",
};

async function main(): Promise<void> {
  const databaseUrl = process.env["DATABASE_URL"];
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is not set");
  }

  const isProduction = process.env["NODE_ENV"] === "production";
  const seedSuperAdminPassword = process.env["SEED_SUPER_ADMIN_PASSWORD"];
  const seedAdminPassword = process.env["SEED_ADMIN_PASSWORD"];
  const adapter = new PrismaPg(databaseUrl);
  const prisma = new PrismaClient({ adapter });

  try {
    // The Permission catalog (module x action capability definitions) is
    // global, not per-company — Role/RolePermission are the per-company
    // parts, seeded per company by tenantBootstrapService.bootstrapTenant
    // below, not here.
    await permissionService.ensureCatalog();
    console.log("Seed: ensured the permission catalog.");

    // Idempotent — a fresh install has no PLATFORM user yet; re-running
    // this script against an already-bootstrapped install must not create
    // a second one.
    const existingSuperAdmin = await prisma.user.findFirst({ where: { userType: "PLATFORM" } });
    if (!existingSuperAdmin) {
      if (isProduction && !seedSuperAdminPassword) {
        throw new Error(
          "SEED_SUPER_ADMIN_PASSWORD must be set before bootstrapping the Super Admin user in a production environment — refusing to fall back to a default password."
        );
      }

      const superAdminPasswordHash = await hashPassword(
        seedSuperAdminPassword ?? DEFAULT_SEED_SUPER_ADMIN_PASSWORD
      );
      await prisma.user.create({
        data: {
          username: "superadmin",
          fullName: "Super Admin",
          email: "superadmin@premgiribooks.local",
          passwordHash: superAdminPasswordHash,
          userType: "PLATFORM",
          companyId: null,
          roleId: null,
        },
      });

      console.log('Seed: created bootstrap Super Admin user "superadmin".');
      console.log(
        seedSuperAdminPassword
          ? 'Seed: sign in with username "superadmin" using the password set via SEED_SUPER_ADMIN_PASSWORD.'
          : 'Seed: sign in with username "superadmin" using the local-development default password documented in prisma/seed.ts. Set SEED_SUPER_ADMIN_PASSWORD to override it.'
      );
    } else {
      console.log('Seed: a PLATFORM user already exists — skipping Super Admin bootstrap.');
    }

    const existingAdmin = await prisma.user.findUnique({ where: { username: "admin" } });
    if (existingAdmin) {
      console.log('Seed: user "admin" already exists — skipping bootstrap company creation.');
      return;
    }

    if (isProduction && !seedAdminPassword) {
      throw new Error(
        "SEED_ADMIN_PASSWORD must be set before bootstrapping the admin user in a production environment — refusing to fall back to a default password."
      );
    }

    const passwordHash = await hashPassword(seedAdminPassword ?? DEFAULT_SEED_ADMIN_PASSWORD);

    // Wrapped in a transaction so a failure partway through can't leave an
    // orphaned company with no Company Admin — and can't cause a duplicate
    // "Default Company" if the seed script is re-run after such a partial
    // failure. Mirrors companyService.createCompany()'s exact workflow
    // (Company -> TenantBootstrapService -> Company Admin User), just
    // without that method's assertSuperAdmin() gate, since this script has
    // no request/session context to gate against — the same reasoning this
    // codebase has always used for seed.ts bypassing service-level auth.
    await prisma.$transaction(async (tx) => {
      const company = await tx.company.create({
        data: {
          companyName: "Default Company",
          legalName: "Default Company",
          settings: { create: {} },
        },
      });

      const { companyAdminRoleId } = await tenantBootstrapService.bootstrapTenant(
        company.id,
        { financialYear: DEFAULT_FINANCIAL_YEAR },
        tx
      );

      await tx.user.create({
        data: {
          username: "admin",
          fullName: "Company Admin",
          email: "admin@premgiribooks.local",
          passwordHash,
          userType: "COMPANY",
          companyId: company.id,
          roleId: companyAdminRoleId,
        },
      });
    });

    console.log('Seed: created bootstrap Company Admin user "admin" and "Default Company".');
    console.log(
      seedAdminPassword
        ? 'Seed: sign in with username "admin" using the password set via SEED_ADMIN_PASSWORD.'
        : 'Seed: sign in with username "admin" using the local-development default password documented in prisma/seed.ts. Set SEED_ADMIN_PASSWORD to override it.'
    );
  } finally {
    await prisma.$disconnect();
    await sharedPrisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
