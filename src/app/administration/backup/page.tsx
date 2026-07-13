import { redirect } from "next/navigation";

import { PlatformShell } from "@/components/layout/platform-shell";
import { ComingSoon } from "@/components/layout/coming-soon";
import { isCurrentUserSuperAdmin } from "@/lib/current-user";

export default async function BackupPage() {
  if (!(await isCurrentUserSuperAdmin())) {
    redirect("/");
  }

  return (
    <PlatformShell>
      <ComingSoon title="Backup & Restore" description="Backup and restore tooling is not implemented yet." />
    </PlatformShell>
  );
}
