import type { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";

/**
 * Scoped narrowly to the Administration-side tenant-lifecycle events this
 * migration introduces (see prisma/schema.prisma's AuditLog model comment)
 * — not a general audit-log write path for every module. Accepts an
 * optional transaction client so a write can participate in the same
 * atomic unit of work as the action it's recording (e.g. Company Created,
 * written inside companyService.createCompany()'s transaction).
 */
export interface RecordAuditLogInput {
  actorUserId: string;
  action: string;
  targetType: string;
  targetId: string;
  companyId?: string | null;
  metadata?: Prisma.InputJsonValue;
}

export const auditLogService = {
  async record(input: RecordAuditLogInput, client: Prisma.TransactionClient | typeof prisma = prisma): Promise<void> {
    await client.auditLog.create({
      data: {
        actorUserId: input.actorUserId,
        action: input.action,
        targetType: input.targetType,
        targetId: input.targetId,
        companyId: input.companyId ?? null,
        metadata: input.metadata ?? undefined,
      },
    });
  },
};
