import type { Prisma } from "@prisma/client";

/**
 * "Full coverage" means a role is currently granted every permission in the
 * live catalog — the name-independent, structural definition this codebase
 * has used since 11-role-permissions.md (a custom role could also be
 * granted full access, not just the one literally named "Company Admin").
 * architecture-Migration-Super-Admin-Administration's per-company Company
 * Admin role is always full-coverage (TenantBootstrapService grants it
 * every catalog permission and its set is never editable), so in practice
 * this also always protects the Company Admin seat — without either
 * role-repository.ts or user-repository.ts ever comparing a role's name.
 *
 * Shared by role-repository.ts's deactivate() ("at least one full-coverage
 * role must remain active per company") and user-repository.ts's
 * updateProfile()/deactivate() ("at least one active user holding a
 * full-coverage role must remain per company") — both invariants reduce to
 * the same structural check.
 */
export async function isFullCoverageRole(
  tx: Prisma.TransactionClient,
  roleId: string
): Promise<boolean> {
  const [totalPermissions, roleWithCount] = await Promise.all([
    tx.permission.count(),
    tx.role.findUnique({
      where: { id: roleId },
      include: { _count: { select: { permissions: true } } },
    }),
  ]);

  if (!roleWithCount || totalPermissions === 0) {
    return false;
  }

  return roleWithCount._count.permissions === totalPermissions;
}

/**
 * Whether at least one *other* active, full-coverage role exists for the
 * given company (excluding `excludeRoleId`) — used to decide whether
 * deactivating/stripping coverage from the role in question would leave the
 * company with zero fully-privileged roles.
 */
export async function hasOtherActiveFullCoverageRole(
  tx: Prisma.TransactionClient,
  companyId: string,
  excludeRoleId: string
): Promise<boolean> {
  const totalPermissions = await tx.permission.count();
  if (totalPermissions === 0) {
    return true; // Nothing to guard — an empty catalog can't be "covered" by anything.
  }

  const otherActiveRoles = await tx.role.findMany({
    where: { companyId, isActive: true, id: { not: excludeRoleId } },
    include: { _count: { select: { permissions: true } } },
  });

  return otherActiveRoles.some((role) => role._count.permissions === totalPermissions);
}
