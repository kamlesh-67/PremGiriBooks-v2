import { PlatformShell } from "@/components/layout/platform-shell";
import { ComingSoon } from "@/components/layout/coming-soon";
import { requireSuperAdmin } from "@/lib/current-user";

export default async function AuditPage() {
  await requireSuperAdmin();

  return (
    <PlatformShell>
      <ComingSoon title="Audit" description="An audit log viewer is not implemented yet." />
    </PlatformShell>
  );
}
