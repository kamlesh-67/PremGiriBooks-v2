import Link from "next/link";
import { redirect } from "next/navigation";
import { Plus } from "lucide-react";

import { AppShell } from "@/components/layout/app-shell";
import { Button } from "@/components/ui/button";
import { getCurrentCompanyUser } from "@/lib/current-user";
import { hasPermission, isCurrentUserCompanyAdmin } from "@/lib/permissions";
import { CustomerFilterBar } from "@/modules/customers/components/customer-filter-bar";
import { CustomerTable } from "@/modules/customers/components/customer-table";
import { customerService } from "@/modules/customers/services/customer-service";
import { CUSTOMER_TYPE_VALUES } from "@/modules/customers/validation/customer-schema";
import type { CustomerListFilters, CustomerType } from "@/types/customer";

interface CustomerListPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

function firstValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

// Filter state lives in the URL (see customer-filter-bar.tsx); unknown values
// are ignored rather than erroring — a hand-edited query string just falls
// back to the unfiltered list.
function parseFilters(params: Record<string, string | string[] | undefined>): CustomerListFilters {
  const filters: CustomerListFilters = {};

  const search = firstValue(params.search)?.trim();
  if (search) {
    filters.search = search;
  }

  const type = firstValue(params.type);
  if (type && (CUSTOMER_TYPE_VALUES as readonly string[]).includes(type)) {
    filters.customerType = type as CustomerType;
  }

  const status = firstValue(params.status);
  if (status === "active" || status === "inactive") {
    filters.status = status;
  }

  return filters;
}

export default async function CustomerListPage({ searchParams }: CustomerListPageProps) {
  const user = await getCurrentCompanyUser();
  const canView = await hasPermission(user, "masters", "view");
  if (!canView) {
    redirect("/");
  }

  const filters = parseFilters(await searchParams);

  const [customers, isAdmin, canCreate, canEdit, canManage] = await Promise.all([
    customerService.listCustomers(filters),
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
            <h1 className="text-xl font-semibold text-foreground">Customers</h1>
            <p className="text-sm text-muted-foreground">
              Manage the permanent customer master your sales documents and pricing will reference.
            </p>
          </div>
          {canCreate ? (
            <Button
              nativeButton={false}
              render={
                <Link href="/masters/customers/new">
                  <Plus size={18} />
                  New Customer
                </Link>
              }
            />
          ) : null}
        </div>

        <CustomerFilterBar />

        <CustomerTable customers={customers} canEdit={canEdit} canManage={canManage} />
      </div>
    </AppShell>
  );
}
