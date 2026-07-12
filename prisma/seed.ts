import "dotenv/config";
import argon2 from "argon2";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

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
// local-development convenience only — override it via SEED_ADMIN_PASSWORD in
// any shared or production environment.
const DEFAULT_SEED_ADMIN_PASSWORD = "Admin@12345";

async function main(): Promise<void> {
  const databaseUrl = process.env["DATABASE_URL"];
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is not set");
  }

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

    const adminRole = await prisma.role.findUniqueOrThrow({ where: { name: "Administrator" } });

    const company = await prisma.company.create({
      data: {
        companyName: "Default Company",
        legalName: "Default Company",
        settings: { create: {} },
      },
    });

    const seedPassword = process.env["SEED_ADMIN_PASSWORD"] ?? DEFAULT_SEED_ADMIN_PASSWORD;
    const passwordHash = await argon2.hash(seedPassword);

    await prisma.user.create({
      data: {
        username: "admin",
        fullName: "Administrator",
        email: "admin@premgiribooks.local",
        passwordHash,
        companyId: company.id,
        roleId: adminRole.id,
      },
    });

    console.log('Seed: created bootstrap Administrator user "admin" and "Default Company".');
    console.log(
      process.env["SEED_ADMIN_PASSWORD"]
        ? "Seed: sign in with the username \"admin\" and the password from SEED_ADMIN_PASSWORD."
        : `Seed: sign in with username "admin" and password "${DEFAULT_SEED_ADMIN_PASSWORD}". Set SEED_ADMIN_PASSWORD to override this default.`
    );
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
