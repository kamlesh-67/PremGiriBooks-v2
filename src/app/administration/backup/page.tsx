import { PlatformShell } from "@/components/layout/platform-shell";
import { ComingSoon } from "@/components/layout/coming-soon";
import { requireSuperAdmin } from "@/lib/current-user";

export default async function BackupPage() {
  await requireSuperAdmin();

  return (
    <PlatformShell>
      <ComingSoon title="Backup & Restore" description="Backup and restore tooling is not implemented yet." />
    </PlatformShell>
  );
}
