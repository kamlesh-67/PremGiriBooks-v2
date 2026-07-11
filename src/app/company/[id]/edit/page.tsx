import { notFound } from "next/navigation";

import { AppShell } from "@/components/layout/app-shell";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { isCurrentUserAdmin } from "@/lib/current-user";
import { companyService } from "@/modules/company/services/company-service";
import { CompanyEditForm } from "@/modules/company/components/company-edit-form";
import { CompanySettingsForm } from "@/modules/company/components/company-settings-form";
import { companySettingsSchema } from "@/modules/company/validation/company-schema";
import { toCompanyFormValues } from "@/modules/company/utils/company-form-values";

interface EditCompanyPageProps {
  params: Promise<{ id: string }>;
}

export default async function EditCompanyPage({ params }: EditCompanyPageProps) {
  const { id } = await params;
  const company = await companyService.getCompany(id);

  if (!company) {
    notFound();
  }

  const settingsDefaults = company.settings
    ? companySettingsSchema.parse(company.settings)
    : undefined;
  const isAdmin = await isCurrentUserAdmin();

  return (
    <AppShell isAdmin={isAdmin}>
      <div className="flex flex-col gap-6 p-6">
        <div>
          <h1 className="text-xl font-semibold text-foreground">
            Edit Company — {company.companyName}
          </h1>
          <p className="text-sm text-muted-foreground">
            Update company profile and settings.
          </p>
        </div>

        <Tabs defaultValue="profile">
          <TabsList>
            <TabsTrigger value="profile">Profile</TabsTrigger>
            <TabsTrigger value="settings">Settings</TabsTrigger>
          </TabsList>
          <TabsContent value="profile">
            <CompanyEditForm
              companyId={company.id}
              defaultValues={toCompanyFormValues(company)}
            />
          </TabsContent>
          <TabsContent value="settings">
            {settingsDefaults && (
              <CompanySettingsForm companyId={company.id} defaultValues={settingsDefaults} />
            )}
          </TabsContent>
        </Tabs>
      </div>
    </AppShell>
  );
}
