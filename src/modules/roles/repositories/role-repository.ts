import { Prisma, type Role } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { hasOtherActiveFullCoverageRole, isFullCoverageRole } from "@/modules/roles/utils/role-coverage";
import { isRecordNotFoundError, isRetryableTransactionError } from "@/modules/roles/utils/prisma-errors";
import { withRetry } from "@/modules/roles/utils/with-retry";
import type { DeactivateRoleResult, RoleWithPermissionCount } from "@/types/role";

const SERIALIZABLE = { isolationLevel: Prisma.TransactionIsolationLevel.Serializable };
const CONFLICT_MESSAGE = "This role was changed by another request. Please try again.";

export const roleRepository = {
  findMany(companyId: string): Promise<RoleWithPermissionCount[]> {
    return prisma.role.findMany({
      where: { companyId },
      include: { _count: { select: { permissions: true } } },
      orderBy: { name: "asc" },
    });
  },

  // A role belonging to a different company must resolve identically to
  // "not found" — mirrors every other tenant-scoped repository in this
  // codebase (user-repository.ts, ledger-group-repository.ts, ...).
  async findById(id: string, companyId: string): Promise<Role | null> {
    const role = await prisma.role.findUnique({ where: { id } });
    if (!role || role.companyId !== companyId) {
      return null;
    }
    return role;
  },

  findByName(companyId: string, name: string): Promise<Role | null> {
    return prisma.role.findUnique({ where: { companyId_name: { companyId, name } } });
  },

  create(
    companyId: string,
    name: string,
    options: { isSystemDefined?: boolean; isProtected?: boolean } = {}
  ): Promise<Role> {
    return prisma.role.create({
      data: {
        companyId,
        name,
        isSystemDefined: options.isSystemDefined ?? false,
        isProtected: options.isProtected ?? false,
      },
    });
  },

  async update(id: string, companyId: string, name: string): Promise<Role | null> {
    try {
      const existing = await prisma.role.findUnique({ where: { id } });
      if (!existing || existing.companyId !== companyId) {
        return null;
      }
      return await prisma.role.update({ where: { id }, data: { name } });
    } catch (error) {
      if (isRecordNotFoundError(error)) {
        return null;
      }
      throw error;
    }
  },

  async setActive(id: string, companyId: string, isActive: boolean): Promise<Role | null> {
    try {
      const existing = await prisma.role.findUnique({ where: { id } });
      if (!existing || existing.companyId !== companyId) {
        return null;
      }
      return await prisma.role.update({ where: { id }, data: { isActive } });
    } catch (error) {
      if (isRecordNotFoundError(error)) {
        return null;
      }
      throw error;
    }
  },

  /**
   * A protected role (every isSystemDefined reserved role — Company Admin,
   * Accountant, Sales, Purchase, Store Manager, Employee) can never be
   * deactivated, full stop — this makes the "last full-coverage role"
   * invariant below effectively unreachable for Company Admin specifically,
   * since it is always both protected and full-coverage. The invariant
   * still guards any *other* role a company might have granted full
   * coverage to (a custom role, or in principle a future non-reserved
   * full-access role). Serializable + withRetry closes the same write-skew
   * race documented previously: two concurrent deactivations of two
   * different full-coverage roles could each see the other as still-active
   * under plain Read Committed and both pass.
   */
  deactivate(id: string, companyId: string): Promise<DeactivateRoleResult> {
    return withRetry(
      () =>
        prisma.$transaction(async (tx) => {
          const role = await tx.role.findUnique({ where: { id } });
          if (!role || role.companyId !== companyId) {
            return { status: "not_found" };
          }

          if (role.isProtected) {
            return { status: "protected" };
          }

          if (role.isActive) {
            const isFullCoverage = await isFullCoverageRole(tx, id);
            if (isFullCoverage) {
              const stillHasFullCoverageRole = await hasOtherActiveFullCoverageRole(tx, companyId, id);
              if (!stillHasFullCoverageRole) {
                return { status: "last_full_coverage_role" };
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
