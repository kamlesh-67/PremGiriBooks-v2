import { AppShell } from "@/components/layout/app-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getCurrentUser, isCurrentUserAdmin } from "@/lib/current-user";
import { ChangePasswordForm } from "@/modules/profile/components/change-password-form";

export default async function ProfilePage() {
  const [currentUser, isAdmin] = await Promise.all([getCurrentUser(), isCurrentUserAdmin()]);

  return (
    <AppShell isAdmin={isAdmin}>
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
              <p className="font-medium text-foreground">{currentUser.username}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Full Name</p>
              <p className="font-medium text-foreground">{currentUser.fullName}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Role</p>
              <p className="font-medium text-foreground">{currentUser.role}</p>
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
    </AppShell>
  );
}
