import { PlatformShell } from "@/components/layout/platform-shell";
import { ComingSoon } from "@/components/layout/coming-soon";
import { requireSuperAdmin } from "@/lib/current-user";

export default async function PlatformSettingsPage() {
  await requireSuperAdmin();

  return (
    <PlatformShell>
      <ComingSoon title="Platform Settings" description="System-wide configuration is not implemented yet." />
    </PlatformShell>
  );
}
