import Link from "next/link";
import { redirect } from "next/navigation";
import { Plus } from "lucide-react";

import { AppShell } from "@/components/layout/app-shell";
import { Button } from "@/components/ui/button";
import { getCurrentCompanyUser } from "@/lib/current-user";
import { hasPermission, isCurrentUserCompanyAdmin } from "@/lib/permissions";
import { SupplierFilterBar } from "@/modules/suppliers/components/supplier-filter-bar";
import { SupplierTable } from "@/modules/suppliers/components/supplier-table";
import { supplierService } from "@/modules/suppliers/services/supplier-service";
import type { SupplierListFilters } from "@/types/supplier";

interface SupplierListPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

function firstValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

// Filter state lives in the URL (see supplier-filter-bar.tsx); unknown values
// are ignored rather than erroring — a hand-edited query string just falls
// back to the unfiltered list.
function parseFilters(params: Record<string, string | string[] | undefined>): SupplierListFilters {
  const filters: SupplierListFilters = {};

  const search = firstValue(params.search)?.trim();
  if (search) {
    filters.search = search;
  }

  const status = firstValue(params.status);
  if (status === "active" || status === "inactive") {
    filters.status = status;
  }

  return filters;
}

export default async function SupplierListPage({ searchParams }: SupplierListPageProps) {
  const user = await getCurrentCompanyUser();
  const canView = await hasPermission(user, "masters", "view");
  if (!canView) {
    redirect("/");
  }

  const filters = parseFilters(await searchParams);

  const [suppliers, isAdmin, canCreate, canEdit, canManage] = await Promise.all([
    supplierService.listSuppliers(filters),
    isCurrentUserCompanyAdmin(),
    hasPermission(user, "masters", "create"),
    hasPermission(user, "masters", "edit"),
    hasPermission(user, "masters", "delete"),
  ]);

  return (
    <AppShell isAdmin={isAdmin}>
      <div className="flex flex-col gap-6 p-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-foreground">Suppliers</h1>
            <p className="text-sm text-muted-foreground">
              Manage the permanent supplier master your purchase documents will reference.
            </p>
          </div>
          {canCreate ? (
            <Button
              nativeButton={false}
              render={
                <Link href="/masters/suppliers/new">
                  <Plus size={18} />
                  New Supplier
                </Link>
              }
            />
          ) : null}
        </div>

        <SupplierFilterBar />

        <SupplierTable suppliers={suppliers} canEdit={canEdit} canManage={canManage} />
      </div>
    </AppShell>
  );
}
