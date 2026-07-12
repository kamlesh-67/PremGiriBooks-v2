import { cache } from "react";

import { prisma } from "@/lib/prisma";
import { AuthorizationError, type CurrentUser } from "@/lib/current-user";

/**
 * Defaults to deny on any missing data — unknown module/action, a role with
 * no matching RolePermission row, or (deliberately) a deactivated role. A
 * deactivated role's existing users keep functioning under it per
 * 11-role-permissions.md ("those users keep their existing role
 * assignment"), so this does not additionally filter by role.isActive —
 * doing so would silently revoke a still-assigned user's access the moment
 * an Administrator hides the role from future selection, which is a
 * different, stronger action than the spec describes.
 *
 * cache()-wrapped so multiple permission checks for the same
 * (user, module, action) within one request/render pass — e.g. a page
 * checking the same permission from a Server Component and a nested one —
 * dedupe to a single query, mirroring current-user.ts's identical use of
 * cache() for getCurrentUser(). Relies on `user` being the same object
 * reference across those calls, which holds here since getCurrentUser()
 * is itself cache()-wrapped per request.
 */
export const hasPermission = cache(
  async (user: CurrentUser, module: string, action: string): Promise<boolean> => {
    if (!module || !action) {
      return false;
    }

    const match = await prisma.rolePermission.findFirst({
      where: {
        role: { name: user.role },
        permission: { module, action },
      },
      select: { id: true },
    });

    return match !== null;
  }
);

export async function assertPermission(
  user: CurrentUser,
  module: string,
  action: string
): Promise<void> {
  const allowed = await hasPermission(user, module, action);
  if (!allowed) {
    throw new AuthorizationError(`You do not have permission to ${action} ${module}.`);
  }
}
