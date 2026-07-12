import Link from "next/link";
import { redirect } from "next/navigation";
import { Plus } from "lucide-react";

import { AppShell } from "@/components/layout/app-shell";
import { Button } from "@/components/ui/button";
import { getCurrentUser, isCurrentUserAdmin } from "@/lib/current-user";
import { userService } from "@/modules/users/services/user-service";
import { UserSearchForm } from "@/modules/users/components/user-search-form";
import { UserTable } from "@/modules/users/components/user-table";

interface UserListPageProps {
  searchParams: Promise<{ search?: string }>;
}

export default async function UserListPage({ searchParams }: UserListPageProps) {
  const isAdmin = await isCurrentUserAdmin();
  if (!isAdmin) {
    redirect("/");
  }

  const params = await searchParams;
  const search = params.search ?? "";

  const currentUser = await getCurrentUser();
  const users = await userService.listUsers({ search: search || undefined });

  return (
    <AppShell isAdmin={isAdmin}>
      <div className="flex flex-col gap-6 p-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-foreground">Users</h1>
            <p className="text-sm text-muted-foreground">
              Manage the user accounts for your company.
            </p>
          </div>
          <Button
            nativeButton={false}
            render={
              <Link href="/settings/users/new">
                <Plus size={18} />
                New User
              </Link>
            }
          />
        </div>

        <UserSearchForm initialSearch={search} />

        <UserTable users={users} currentUserId={currentUser.id} />
      </div>
    </AppShell>
  );
}
