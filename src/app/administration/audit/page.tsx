import { redirect } from "next/navigation";

import { PlatformShell } from "@/components/layout/platform-shell";
import { ComingSoon } from "@/components/layout/coming-soon";
import { isCurrentUserSuperAdmin } from "@/lib/current-user";

export default async function AuditPage() {
  if (!(await isCurrentUserSuperAdmin())) {
    redirect("/");
  }

  return (
    <PlatformShell>
      <ComingSoon title="Audit" description="An audit log viewer is not implemented yet." />
    </PlatformShell>
  );
}
