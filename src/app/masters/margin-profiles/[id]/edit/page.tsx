import { notFound, redirect } from "next/navigation";

import { AppShell } from "@/components/layout/app-shell";
import { getCurrentCompanyUser } from "@/lib/current-user";
import { hasPermission, isCurrentUserCompanyAdmin } from "@/lib/permissions";
import { MarginProfileForm } from "@/modules/margin-profiles/components/margin-profile-form";
import { marginProfileService } from "@/modules/margin-profiles/services/margin-profile-service";

interface EditMarginProfilePageProps {
  params: Promise<{ id: string }>;
}

export default async function EditMarginProfilePage({ params }: EditMarginProfilePageProps) {
  const { id } = await params;

  const user = await getCurrentCompanyUser();
  const canEdit = await hasPermission(user, "masters", "edit");
  if (!canEdit) {
    redirect("/masters/margin-profiles");
  }

  const marginProfile = await marginProfileService.getMarginProfile(id);
  if (!marginProfile) {
    notFound();
  }

  const isAdmin = await isCurrentUserCompanyAdmin();

  return (
    <AppShell isAdmin={isAdmin}>
      <div className="flex flex-col gap-6 p-6">
        <div>
          <h1 className="text-xl font-semibold text-foreground">
            Edit Margin Profile — {marginProfile.name}
          </h1>
          <p className="text-sm text-muted-foreground">
            Update the profile&apos;s name, calculation mode, tier percentages, and description.
          </p>
        </div>

        <MarginProfileForm marginProfile={marginProfile} />
      </div>
    </AppShell>
  );
}
