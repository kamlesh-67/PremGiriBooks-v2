import type { Role } from "@prisma/client";

import { prisma } from "@/lib/prisma";

// A minimal read-only surface — the Role table has no dedicated module yet
// (custom role creation is deferred to 11-role-permissions.md). This exists
// only to back the User form's Role Select and server-side existence checks.
export const roleRepository = {
  findMany(): Promise<Role[]> {
    return prisma.role.findMany({ orderBy: { name: "asc" } });
  },

  findById(id: string): Promise<Role | null> {
    return prisma.role.findUnique({ where: { id } });
  },
};
