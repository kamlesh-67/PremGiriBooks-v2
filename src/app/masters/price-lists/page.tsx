import Link from "next/link";
import { redirect } from "next/navigation";
import { Plus } from "lucide-react";

import { AppShell } from "@/components/layout/app-shell";
import { Button } from "@/components/ui/button";
import { getCurrentCompanyUser } from "@/lib/current-user";
import { hasPermission, isCurrentUserCompanyAdmin } from "@/lib/permissions";
import { PriceListFilterBar } from "@/modules/price-lists/components/price-list-filter-bar";
import { PriceListTable } from "@/modules/price-lists/components/price-list-table";
import { priceListService } from "@/modules/price-lists/services/price-list-service";
import type { PriceListListFilters } from "@/types/price-list";

interface PriceListListPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

function firstValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

// Filter state lives in the URL (see price-list-filter-bar.tsx); unknown
// values are ignored rather than erroring — a hand-edited query string just
// falls back to the unfiltered list.
function parseFilters(
  params: Record<string, string | string[] | undefined>
): PriceListListFilters {
  const filters: PriceListListFilters = {};

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

export default async function PriceListListPage({ searchParams }: PriceListListPageProps) {
  const user = await getCurrentCompanyUser();
  const canView = await hasPermission(user, "masters", "view");
  if (!canView) {
    redirect("/");
  }

  const filters = parseFilters(await searchParams);

  const [priceLists, isAdmin, canCreate, canEdit, canManage] = await Promise.all([
    priceListService.listPriceLists(filters),
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
            <h1 className="text-xl font-semibold text-foreground">Price Lists</h1>
            <p className="text-sm text-muted-foreground">
              Manage named collections of fixed selling prices the Pricing Engine will consult
              before falling back to margin calculation.
            </p>
          </div>
          {canCreate ? (
            <Button
              nativeButton={false}
              render={
                <Link href="/masters/price-lists/new">
                  <Plus size={18} />
                  New Price List
                </Link>
              }
            />
          ) : null}
        </div>

        <PriceListFilterBar />

        <PriceListTable priceLists={priceLists} canEdit={canEdit} canManage={canManage} />
      </div>
    </AppShell>
  );
}
