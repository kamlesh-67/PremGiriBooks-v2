import { BookOpen } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LoginForm } from "@/components/auth/login-form";

export default function LoginPage() {
  const appVersion = process.env.APP_VERSION ?? "1.0.0";

  return (
    <div className="flex min-h-screen w-full items-center justify-center bg-background p-4">
      <div className="flex w-full max-w-sm flex-col gap-6">
        <div className="flex flex-col items-center gap-2 text-center">
          <BookOpen size={28} className="text-primary" />
          <h1 className="text-lg font-semibold text-foreground">Premgiri Books ERP</h1>
        </div>

        <Card className="rounded-2xl">
          <CardHeader>
            <CardTitle className="text-base">Sign in</CardTitle>
          </CardHeader>
          <CardContent>
            <LoginForm />
          </CardContent>
        </Card>

        <p className="text-center text-xs text-muted-foreground">
          v{appVersion} · © {new Date().getFullYear()} Premgiri Books ERP
        </p>
      </div>
    </div>
  );
}
