import { redirect } from "next/navigation";

import { PlatformShell } from "@/components/layout/platform-shell";
import { ComingSoon } from "@/components/layout/coming-soon";
import { isCurrentUserSuperAdmin } from "@/lib/current-user";

export default async function PlatformSettingsPage() {
  if (!(await isCurrentUserSuperAdmin())) {
    redirect("/");
  }

  return (
    <PlatformShell>
      <ComingSoon title="Platform Settings" description="System-wide configuration is not implemented yet." />
    </PlatformShell>
  );
}
