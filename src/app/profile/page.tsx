import { AppShell } from "@/components/layout/app-shell";
import { PlatformShell } from "@/components/layout/platform-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getCurrentUser } from "@/lib/current-user";
import { hasPermission, isCurrentUserCompanyAdmin } from "@/lib/permissions";
import { ChangePasswordForm } from "@/modules/profile/components/change-password-form";
import { companyService } from "@/modules/company/services/company-service";
import { CompanySettingsForm } from "@/modules/company/components/company-settings-form";
import { companySettingsSchema, type CompanySettingsInput } from "@/modules/company/validation/company-schema";

// /profile is reachable by both PLATFORM and COMPANY users (proxy.ts's
// PLATFORM_ALLOWED_PREFIXES) — renders under PlatformShell for a Super
// Admin (no "current company," different nav) and AppShell for everyone
// else, per Permanent Architecture Principle 8.
export default async function ProfilePage() {
  const currentUser = await getCurrentUser();

  if (currentUser.userType === "PLATFORM") {
    return (
      <PlatformShell>
        <ProfileContent username={currentUser.username} fullName={currentUser.fullName} roleLabel="Super Admin" />
      </PlatformShell>
    );
  }

  const isAdmin = await isCurrentUserCompanyAdmin();

  // Company Settings (theme/date format/number format/currency display
  // format — moved here from /company/[id]/edit) is gated on the same
  // "company"/"edit" permission that page used, not shown to every user.
  const canEditCompany = await hasPermission(currentUser, "company", "edit");
  let companySettings: CompanySettingsTabData | undefined;
  if (canEditCompany) {
    const company = await companyService.getCompany(currentUser.companyId);
    const parsed = company?.settings ? companySettingsSchema.safeParse(company.settings) : undefined;
    if (company && parsed?.success) {
      companySettings = { companyId: company.id, companyName: company.companyName, defaultValues: parsed.data };
    }
  }

  return (
    <AppShell isAdmin={isAdmin}>
      <ProfileContent
        username={currentUser.username}
        fullName={currentUser.fullName}
        roleLabel={currentUser.role}
        companySettings={companySettings}
      />
    </AppShell>
  );
}

interface CompanySettingsTabData {
  companyId: string;
  companyName: string;
  defaultValues: CompanySettingsInput;
}

interface ProfileContentProps {
  username: string;
  fullName: string;
  roleLabel: string;
  companySettings?: CompanySettingsTabData;
}

function ProfileContent({ username, fullName, roleLabel, companySettings }: ProfileContentProps) {
  const accountCards = (
    <div className="flex flex-col gap-6">
      <Card className="max-w-xl">
        <CardHeader>
          <CardTitle>Account</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-muted-foreground">Username</p>
            <p className="font-medium text-foreground">{username}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Full Name</p>
            <p className="font-medium text-foreground">{fullName}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Role</p>
            <p className="font-medium text-foreground">{roleLabel}</p>
          </div>
        </CardContent>
      </Card>

      <Card className="max-w-xl">
        <CardHeader>
          <CardTitle>Change Password</CardTitle>
        </CardHeader>
        <CardContent>
          <ChangePasswordForm />
        </CardContent>
      </Card>
    </div>
  );

  if (!companySettings) {
    return (
      <div className="flex flex-col gap-6 p-6">
        <div>
          <h1 className="text-xl font-semibold text-foreground">My Profile</h1>
          <p className="text-sm text-muted-foreground">
            View your account details and change your password.
          </p>
        </div>
        {accountCards}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 p-6">
      <div>
        <h1 className="text-xl font-semibold text-foreground">My Profile</h1>
        <p className="text-sm text-muted-foreground">
          View your account details, change your password, and manage company settings.
        </p>
      </div>

      <Tabs defaultValue="account">
        <TabsList>
          <TabsTrigger value="account">Account</TabsTrigger>
          <TabsTrigger value="company-settings">Company Settings</TabsTrigger>
        </TabsList>
        <TabsContent value="account" className="pt-4">
          {accountCards}
        </TabsContent>
        <TabsContent value="company-settings" className="pt-4">
          <Card className="max-w-xl">
            <CardHeader>
              <CardTitle>Company Settings — {companySettings.companyName}</CardTitle>
            </CardHeader>
            <CardContent>
              <CompanySettingsForm
                companyId={companySettings.companyId}
                defaultValues={companySettings.defaultValues}
              />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
