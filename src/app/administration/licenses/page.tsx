import { PlatformShell } from "@/components/layout/platform-shell";
import { ComingSoon } from "@/components/layout/coming-soon";
import { requireSuperAdmin } from "@/lib/current-user";

export default async function LicensesPage() {
  await requireSuperAdmin();

  return (
    <PlatformShell>
      <ComingSoon title="Licenses" description="License management is not implemented yet." />
    </PlatformShell>
  );
}
