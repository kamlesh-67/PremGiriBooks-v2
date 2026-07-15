import Link from "next/link";
import { redirect } from "next/navigation";
import { Building2, CalendarRange, FolderTree, Ruler, Tag } from "lucide-react";

import { AppShell } from "@/components/layout/app-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { isCurrentUserCompanyAdmin } from "@/lib/permissions";

const MASTERS_MODULES = [
  {
    href: "/company",
    icon: Building2,
    title: "Company Management",
    description: "Manage company profiles, settings, and branding.",
  },
  {
    href: "/financial-year",
    icon: CalendarRange,
    title: "Financial Year Management",
    description: "Manage financial years, current year, and closing.",
  },
  {
    href: "/masters/units",
    icon: Ruler,
    title: "Units",
    description: "Manage the units of measure used by products and documents.",
  },
  {
    href: "/masters/categories",
    icon: FolderTree,
    title: "Categories",
    description: "Manage the product classification tree used by products and reports.",
  },
  {
    href: "/masters/brands",
    icon: Tag,
    title: "Brands",
    description: "Manage the product brands and manufacturers referenced by products.",
  },
] as const;

export default async function MastersPage() {
  const isAdmin = await isCurrentUserCompanyAdmin();
  if (!isAdmin) {
    redirect("/");
  }

  return (
    <AppShell isAdmin={isAdmin}>
      <div className="flex flex-col gap-6 p-6">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Masters</h1>
          <p className="text-sm text-muted-foreground">
            Manage the master data modules for your ERP.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {MASTERS_MODULES.map((module) => (
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
