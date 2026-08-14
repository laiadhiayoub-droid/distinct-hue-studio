import { createFileRoute, Outlet, Link } from "@tanstack/react-router";

import { useAuth } from "@/hooks/useAuth";
import { Toaster } from "@/components/ui/sonner";

export const Route = createFileRoute("/_authenticated")({
  component: AppShell,
});

const NAV = [
  { to: "/dashboard", label: "Dashboard" },
  { to: "/quiz", label: "Quiz" },
  { to: "/scan", label: "Scan" },
  { to: "/tutor", label: "Tutor" },
] as const;

function AppShell() {
  const { user, loading } = useAuth();

  if (loading || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">
        Loading your study desk…
      </div>
    );
  }


  return (
    <div className="grain relative min-h-screen">
      <div className="rule-grid pointer-events-none absolute inset-0 opacity-30" />
      <header className="relative border-b border-border/70 bg-card/60 backdrop-blur">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-4 px-5 py-4">
          <Link to="/dashboard" className="text-xs font-semibold uppercase tracking-[0.3em]">
            Imtihanat
          </Link>
          <nav className="flex flex-1 flex-wrap gap-1 text-sm">
            {NAV.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                className="rounded-full px-4 py-1.5 text-muted-foreground transition-colors hover:bg-secondary"
                activeProps={{ className: "bg-secondary text-foreground font-medium" }}
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </div>
      </header>

      <main className="relative mx-auto max-w-6xl px-5 py-10">
        <Outlet />
      </main>
      <Toaster />
    </div>
  );
}
