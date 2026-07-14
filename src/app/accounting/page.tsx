import Link from "next/link";
import { redirect } from "next/navigation";
import { BookText, Landmark, ListTree, Receipt } from "lucide-react";

import { AppShell } from "@/components/layout/app-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getCurrentCompanyUser } from "@/lib/current-user";
import { hasPermission, isCurrentUserCompanyAdmin } from "@/lib/permissions";

const ACCOUNTING_MODULES = [
  {
    href: "/accounting/ledger-groups",
    icon: ListTree,
    title: "Ledger Groups",
    description: "Manage the chart-of-accounts group hierarchy.",
  },
  {
    href: "/accounting/ledgers",
    icon: BookText,
    title: "Ledger Master",
    description: "Manage the individual accounting ledgers under each group.",
  },
  {
    href: "/accounting/banks",
    icon: Landmark,
    title: "Bank Management",
    description: "Manage your company's bank accounts.",
  },
  {
    href: "/accounting/expense-heads",
    icon: Receipt,
    title: "Expense Heads",
    description: "Manage operating expense ledgers under Direct and Indirect Expenses.",
  },
] as const;

export default async function AccountingHubPage() {
  const user = await getCurrentCompanyUser();
  const canView = await hasPermission(user, "accounting", "view");
  if (!canView) {
    redirect("/");
  }

  const isAdmin = await isCurrentUserCompanyAdmin();

  return (
    <AppShell isAdmin={isAdmin}>
      <div className="flex flex-col gap-6 p-6">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Accounting</h1>
          <p className="text-sm text-muted-foreground">
            Manage the accounting foundation modules for your ERP.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {ACCOUNTING_MODULES.map((module) => (
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
