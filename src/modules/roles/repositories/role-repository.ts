import { Prisma, type Role } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { isRecordNotFoundError, isRetryableTransactionError } from "@/modules/roles/utils/prisma-errors";
import { withRetry } from "@/modules/roles/utils/with-retry";
import type { DeactivateRoleResult, RoleWithPermissionCount } from "@/types/role";

const SERIALIZABLE = { isolationLevel: Prisma.TransactionIsolationLevel.Serializable };
const CONFLICT_MESSAGE = "This role was changed by another request. Please try again.";

export const roleRepository = {
  findMany(): Promise<RoleWithPermissionCount[]> {
    return prisma.role.findMany({
      include: { _count: { select: { permissions: true } } },
      orderBy: { name: "asc" },
    });
  },

  findById(id: string): Promise<Role | null> {
    return prisma.role.findUnique({ where: { id } });
  },

  findByName(name: string): Promise<Role | null> {
    return prisma.role.findUnique({ where: { name } });
  },

  create(name: string): Promise<Role> {
    return prisma.role.create({ data: { name } });
  },

  async update(id: string, name: string): Promise<Role | null> {
    try {
      return await prisma.role.update({ where: { id }, data: { name } });
    } catch (error) {
      if (isRecordNotFoundError(error)) {
        return null;
      }
      throw error;
    }
  },

  async setActive(id: string, isActive: boolean): Promise<Role | null> {
    try {
      return await prisma.role.update({ where: { id }, data: { isActive } });
    } catch (error) {
      if (isRecordNotFoundError(error)) {
        return null;
      }
      throw error;
    }
  },

  /**
   * "Administrator-capable" means an active role currently granted every
   * permission in the catalog (full module x action coverage) — not merely a
   * role literally named "Administrator," since a custom role could also be
   * granted full access. Deactivating the last such role would leave the
   * system with no fully-privileged role at all, mirroring
   * 10-user-management.md's "last active Administrator user" guard at the
   * role level. Serializable + withRetry closes the same write-skew race
   * user-repository.ts's deactivate() documents: two concurrent deactivations
   * of two different Administrator-capable roles could each see the other as
   * still-active and both pass a plain Read Committed count check.
   */
  deactivate(id: string): Promise<DeactivateRoleResult> {
    return withRetry(
      () =>
        prisma.$transaction(async (tx) => {
          const role = await tx.role.findUnique({
            where: { id },
            include: { _count: { select: { permissions: true } } },
          });
          if (!role) {
            return { status: "not_found" };
          }

          if (role.isActive) {
            const totalPermissions = await tx.permission.count();
            const isFullCoverage =
              totalPermissions > 0 && role._count.permissions === totalPermissions;

            if (isFullCoverage) {
              const otherActiveRoles = await tx.role.findMany({
                where: { isActive: true, id: { not: id } },
                include: { _count: { select: { permissions: true } } },
              });
              const stillHasFullCoverageRole = otherActiveRoles.some(
                (other) => other._count.permissions === totalPermissions
              );
              if (!stillHasFullCoverageRole) {
                return { status: "last_administrator_capable" };
              }
            }
          }

          const updated = await tx.role.update({ where: { id }, data: { isActive: false } });
          return { status: "ok", role: updated };
        }, SERIALIZABLE),
      isRetryableTransactionError,
      CONFLICT_MESSAGE
    );
  },
};
