import type { Role } from "@prisma/client";

import { prisma } from "@/lib/prisma";

// A minimal read-only surface backing the User form's Role Select and
// server-side existence checks. Full Role CRUD lives in
// modules/roles/repositories/role-repository.ts (11-role-permissions.md).
export const roleRepository = {
  // Only active roles are offered for new assignment, per
  // 11-role-permissions.md: "10-user-management.md's user form must exclude
  // inactive roles from its Role select." A user already assigned an
  // inactive role keeps it (see user-form-values.ts callers merging it back
  // in for the Edit page) — this method only governs what's selectable going
  // forward.
  findMany(companyId: string): Promise<Role[]> {
    return prisma.role.findMany({ where: { companyId, isActive: true }, orderBy: { name: "asc" } });
  },

  findById(id: string): Promise<Role | null> {
    return prisma.role.findUnique({ where: { id } });
  },
};
