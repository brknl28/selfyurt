import { Link, Outlet, createRootRoute, useNavigate, useRouterState } from "@tanstack/react-router";
import { useMutation, useQuery } from "@tanstack/react-query";

import { api } from "@/lib/api";
import { queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";

function RootLayout() {
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (state) => state.location.pathname });

  const meQuery = useQuery({
    queryKey: ["session"],
    queryFn: async () => {
      try {
        const result = await api.me();
        return result.user;
      } catch {
        return null;
      }
    }
  });

  const logoutMutation = useMutation({
    mutationFn: () => api.logout(),
    onSuccess: async () => {
      await queryClient.invalidateQueries();
      navigate({ to: "/login" });
    }
  });

  return (
    <div className="min-h-screen">
      <header className="border-b bg-card/90 backdrop-blur">
        <div className="container flex h-14 items-center justify-between gap-4">
          <Link to="/dashboard" className="text-sm font-semibold tracking-wide">
            SelfYurt
          </Link>

          {meQuery.data ? (
            <nav className="flex items-center gap-2 text-sm">
              <Link to="/dashboard" className={pathname.startsWith("/dashboard") ? "text-primary" : "text-muted-foreground"}>
                Dashboard
              </Link>
              <Link to="/gallery" className={pathname.startsWith("/gallery") ? "text-primary" : "text-muted-foreground"}>
                Gallery
              </Link>
              <Link to="/settings" className={pathname.startsWith("/settings") ? "text-primary" : "text-muted-foreground"}>
                Settings
              </Link>
              <Button
                variant="outline"
                size="sm"
                onClick={() => logoutMutation.mutate()}
                disabled={logoutMutation.isPending}
              >
                Logout
              </Button>
            </nav>
          ) : (
            <nav>
              <Link to="/login" className="text-sm text-muted-foreground">
                Login
              </Link>
            </nav>
          )}
        </div>
      </header>

      <main className="container py-8">
        <Outlet />
      </main>
    </div>
  );
}

export const rootRoute = createRootRoute({
  component: RootLayout
});
