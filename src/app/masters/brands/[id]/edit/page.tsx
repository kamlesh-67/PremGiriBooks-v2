import { notFound, redirect } from "next/navigation";

import { AppShell } from "@/components/layout/app-shell";
import { getCurrentCompanyUser } from "@/lib/current-user";
import { hasPermission, isCurrentUserCompanyAdmin } from "@/lib/permissions";
import { brandService } from "@/modules/brands/services/brand-service";
import { BrandForm } from "@/modules/brands/components/brand-form";

interface EditBrandPageProps {
  params: Promise<{ id: string }>;
}

export default async function EditBrandPage({ params }: EditBrandPageProps) {
  const { id } = await params;

  const user = await getCurrentCompanyUser();
  const canEdit = await hasPermission(user, "masters", "edit");
  if (!canEdit) {
    redirect("/masters/brands");
  }

  const brand = await brandService.getBrand(id);
  if (!brand) {
    notFound();
  }

  const isAdmin = await isCurrentUserCompanyAdmin();

  return (
    <AppShell isAdmin={isAdmin}>
      <div className="flex flex-col gap-6 p-6">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Edit Brand — {brand.name}</h1>
          <p className="text-sm text-muted-foreground">
            Update the brand&apos;s name and description.
          </p>
        </div>

        <BrandForm brand={brand} />
      </div>
    </AppShell>
  );
}
