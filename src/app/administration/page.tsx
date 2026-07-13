import Link from "next/link";
import { redirect } from "next/navigation";
import { Building2, ShieldCheck, KeyRound, Settings, ScrollText, DatabaseBackup } from "lucide-react";

import { PlatformShell } from "@/components/layout/platform-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { isCurrentUserSuperAdmin } from "@/lib/current-user";

const ADMINISTRATION_MODULES = [
  {
    href: "/administration/companies",
    icon: Building2,
    title: "Companies",
    description: "Create, edit, activate, and deactivate companies.",
  },
  {
    href: "/administration/company-admins",
    icon: ShieldCheck,
    title: "Company Admins",
    description: "Reset passwords and activate/deactivate Company Admins across every company.",
  },
  {
    href: "/administration/licenses",
    icon: KeyRound,
    title: "Licenses",
    description: "Coming soon.",
  },
  {
    href: "/administration/settings",
    icon: Settings,
    title: "Platform Settings",
    description: "Coming soon.",
  },
  {
    href: "/administration/audit",
    icon: ScrollText,
    title: "Audit",
    description: "Coming soon.",
  },
  {
    href: "/administration/backup",
    icon: DatabaseBackup,
    title: "Backup",
    description: "Coming soon.",
  },
] as const;

export default async function AdministrationHubPage() {
  const isSuperAdmin = await isCurrentUserSuperAdmin();
  if (!isSuperAdmin) {
    redirect("/");
  }

  return (
    <PlatformShell>
      <div className="flex flex-col gap-6 p-6">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Administration</h1>
          <p className="text-sm text-muted-foreground">
            Platform-wide management — companies, Company Admins, and system configuration.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {ADMINISTRATION_MODULES.map((module) => (
            <Link key={module.href} href={module.href}>
              <Card className="transition-colors hover:bg-muted/40">
                <CardHeader>
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-dashed border-border text-muted-foreground">
                      <module.icon size={20} />
                    </div>
                    <CardTitle>{module.title}</CardTitle>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-xs text-muted-foreground">{module.description}</p>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </div>
    </PlatformShell>
  );
}
