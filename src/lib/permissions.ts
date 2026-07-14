import { cache } from "react";

import { prisma } from "@/lib/prisma";
import { AuthorizationError, getCurrentCompanyUser, type CompanyCurrentUser } from "@/lib/current-user";

/**
 * Only ever called for a CompanyCurrentUser — a PLATFORM user (Super Admin)
 * has no Role/company and bypasses this entirely via assertSuperAdmin()
 * (Permanent Architecture Principle 9: no platform.* permission catalog).
 *
 * Filters by companyId as well as role name — Role.name is only unique
 * *per company* now (architecture-Migration-Super-Admin-Administration's
 * per-company role split), so a name-only lookup would ambiguously match
 * another company's identically-named role.
 *
 * Deliberately does NOT additionally filter by role.isActive — a
 * deactivated role's existing users keep functioning under it per
 * 11-role-permissions.md ("those users keep their existing role
 * assignment"), so filtering here would silently revoke a still-assigned
 * user's access the moment a Company Admin hides the role from future
 * selection, which is a different, stronger action than the spec
 * describes. Defaults to deny only for an unknown module/action or a role
 * with no matching RolePermission row.
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
  async (user: CompanyCurrentUser, module: string, action: string): Promise<boolean> => {
    if (!module || !action) {
      return false;
    }

    const match = await prisma.rolePermission.findFirst({
      where: {
        role: { name: user.role, companyId: user.companyId },
        permission: { module, action },
      },
      select: { id: true },
    });

    return match !== null;
  }
);

export async function assertPermission(
  user: CompanyCurrentUser,
  module: string,
  action: string
): Promise<void> {
  const allowed = await hasPermission(user, module, action);
  if (!allowed) {
    throw new AuthorizationError(`You do not have permission to ${action} ${module}.`);
  }
}

/**
 * Coarse nav/page-visibility gate for pages that used to call the removed
 * isCurrentUserAdmin() (Masters/Settings/Company/User/Role Management hub
 * pages and the Sidebar's adminOnly nav filter) — replaced with a real
 * permission check instead of a role-name compare, per Permanent
 * Architecture Principle 1/2. "settings"/"view" is granted to the
 * Company Admin role's full catalog coverage and to no other reserved
 * role's starting permission set, so this preserves today's exact
 * behavior (only a Company Admin sees these) without hardcoding a name.
 * Only ever called on a route already guaranteed to be COMPANY-only by
 * proxy.ts.
 */
export async function isCurrentUserCompanyAdmin(): Promise<boolean> {
  const user = await getCurrentCompanyUser();
  return hasPermission(user, "settings", "view");
}
