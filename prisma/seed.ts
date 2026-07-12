import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { hashPassword } from "../src/lib/password";

// Default roles per 07-authentication.md — "Do not implement custom roles yet."
const DEFAULT_ROLES = [
  "Administrator",
  "Accountant",
  "Sales",
  "Purchase",
  "Store Manager",
  "Employee",
];

// 07-authentication.md explicitly excludes a registration screen, so the very
// first Administrator must be bootstrapped here. This default password is a
// local-development convenience only — production-like environments must set
// SEED_ADMIN_PASSWORD explicitly (enforced below) rather than relying on it.
const DEFAULT_SEED_ADMIN_PASSWORD = "Admin@12345";

async function main(): Promise<void> {
  const databaseUrl = process.env["DATABASE_URL"];
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is not set");
  }

  const seedAdminPassword = process.env["SEED_ADMIN_PASSWORD"];
  const adapter = new PrismaPg(databaseUrl);
  const prisma = new PrismaClient({ adapter });

  try {
    for (const name of DEFAULT_ROLES) {
      await prisma.role.upsert({ where: { name }, update: {}, create: { name } });
    }
    console.log(`Seed: ensured ${DEFAULT_ROLES.length} default roles.`);

    const existingAdmin = await prisma.user.findUnique({ where: { username: "admin" } });
    if (existingAdmin) {
      console.log('Seed: user "admin" already exists — skipping bootstrap user/company creation.');
      return;
    }

    if (process.env["NODE_ENV"] === "production" && !seedAdminPassword) {
      throw new Error(
        "SEED_ADMIN_PASSWORD must be set before bootstrapping the admin user in a production environment — refusing to fall back to a default password."
      );
    }

    const adminRole = await prisma.role.findUniqueOrThrow({ where: { name: "Administrator" } });
    const passwordHash = await hashPassword(seedAdminPassword ?? DEFAULT_SEED_ADMIN_PASSWORD);

    // Wrapped in a transaction so a failure partway through (e.g. the user
    // insert failing after the company insert succeeds) can't leave an
    // orphaned company with no admin user — and can't cause a duplicate
    // "Default Company" to be created if the seed script is re-run after
    // such a partial failure.
    await prisma.$transaction(async (tx) => {
      const company = await tx.company.create({
        data: {
          companyName: "Default Company",
          legalName: "Default Company",
          settings: { create: {} },
        },
      });

      await tx.user.create({
        data: {
          username: "admin",
          fullName: "Administrator",
          email: "admin@premgiribooks.local",
          passwordHash,
          companyId: company.id,
          roleId: adminRole.id,
        },
      });
    });

    console.log('Seed: created bootstrap Administrator user "admin" and "Default Company".');
    console.log(
      seedAdminPassword
        ? 'Seed: sign in with username "admin" using the password set via SEED_ADMIN_PASSWORD.'
        : 'Seed: sign in with username "admin" using the local-development default password documented in prisma/seed.ts. Set SEED_ADMIN_PASSWORD to override it.'
    );
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
