import Link from "next/link";
import { redirect } from "next/navigation";
import { ShieldCheck, Users as UsersIcon } from "lucide-react";

import { AppShell } from "@/components/layout/app-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { isCurrentUserAdmin } from "@/lib/current-user";

const SETTINGS_MODULES = [
  {
    href: "/settings/users",
    icon: UsersIcon,
    title: "User Management",
    description: "Create and manage user accounts for your company.",
  },
  {
    href: "/settings/roles",
    icon: ShieldCheck,
    title: "Roles & Permissions",
    description: "Manage roles and the permissions each role grants.",
  },
] as const;

export default async function SettingsPage() {
  const isAdmin = await isCurrentUserAdmin();
  if (!isAdmin) {
    redirect("/");
  }

  return (
    <AppShell isAdmin={isAdmin}>
      <div className="flex flex-col gap-6 p-6">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Settings</h1>
          <p className="text-sm text-muted-foreground">
            Administration and security configuration.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {SETTINGS_MODULES.map((module) => (
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
    </AppShell>
  );
}
