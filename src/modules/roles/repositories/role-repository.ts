import { Prisma, type Role } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { runInTransaction } from "@/lib/transaction";
import { hasOtherActiveFullCoverageRole, isFullCoverageRole } from "@/modules/roles/utils/role-coverage";
import { isRecordNotFoundError, isRetryableTransactionError } from "@/modules/roles/utils/prisma-errors";
import type { DeactivateRoleResult, RoleWithPermissionCount } from "@/types/role";

const SERIALIZABLE_RETRY = {
  isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
  retryable: isRetryableTransactionError,
  conflictMessage: "This role was changed by another request. Please try again.",
};

export const roleRepository = {
  findMany(companyId: string): Promise<RoleWithPermissionCount[]> {
    return prisma.role.findMany({
      where: { companyId },
      include: { _count: { select: { permissions: true } } },
      orderBy: { name: "asc" },
    });
  },

  // Platform-wide (cross-company) read, unlike every other method here —
  // used only by permissionService.ensureCatalog() at boot/seed time to
  // backfill catalog growth into every company's already-seeded protected
  // role of this name (e.g. Company Admin), never per-request. Gating that
  // caller (none needed here — a boot-time system task, not a user action)
  // stays the caller's concern, per this repository's usual
  // "no authorization here" rule.
  findAllProtectedByName(name: string): Promise<Role[]> {
    return prisma.role.findMany({ where: { isProtected: true, name } });
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

  // A protected role can never be renamed — role-service.ts already checks
  // this before calling in, but repeating it here mirrors deactivate()'s
  // own defense-in-depth "protected" check just below, rather than relying
  // solely on the one service-layer call site to never regress.
  async update(id: string, companyId: string, name: string): Promise<Role | null> {
    try {
      const existing = await prisma.role.findUnique({ where: { id } });
      if (!existing || existing.companyId !== companyId) {
        return null;
      }
      if (existing.isProtected && name !== existing.name) {
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
   * full-access role). runInTransaction's Serializable + retry option closes the same write-skew
   * race documented previously: two concurrent deactivations of two
   * different full-coverage roles could each see the other as still-active
   * under plain Read Committed and both pass.
   */
  deactivate(id: string, companyId: string): Promise<DeactivateRoleResult> {
    return runInTransaction(async (tx) => {
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
    }, SERIALIZABLE_RETRY);
  },
};
