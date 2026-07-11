import { AppShell } from "@/components/layout/app-shell";

export default function Home() {
  return (
    <AppShell>
      <div className="flex h-full items-center justify-center">
        <p className="text-sm text-muted-foreground">
          Premgiri Books ERP — application shell ready.
        </p>
      </div>
    </AppShell>
  );
}
