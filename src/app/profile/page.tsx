import { AppShell } from "@/components/layout/app-shell";
import { PlatformShell } from "@/components/layout/platform-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getCurrentUser } from "@/lib/current-user";
import { isCurrentUserCompanyAdmin } from "@/lib/permissions";
import { ChangePasswordForm } from "@/modules/profile/components/change-password-form";

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

  return (
    <AppShell isAdmin={isAdmin}>
      <ProfileContent
        username={currentUser.username}
        fullName={currentUser.fullName}
        roleLabel={currentUser.role}
      />
    </AppShell>
  );
}

interface ProfileContentProps {
  username: string;
  fullName: string;
  roleLabel: string;
}

function ProfileContent({ username, fullName, roleLabel }: ProfileContentProps) {
  return (
    <div className="flex flex-col gap-6 p-6">
      <div>
        <h1 className="text-xl font-semibold text-foreground">My Profile</h1>
        <p className="text-sm text-muted-foreground">
          View your account details and change your password.
        </p>
      </div>

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
}
