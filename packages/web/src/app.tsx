import { QueryClientProvider } from "@tanstack/react-query";
import { RouterProvider, createRoute, createRouter, redirect } from "@tanstack/react-router";

import { queryClient } from "./lib/queryClient";
import { api } from "./lib/api";
import { rootRoute } from "./routes/__root";
import { loginRoute } from "./routes/login";
import { dashboardRoute } from "./routes/dashboard";
import { galleryRoute } from "./routes/gallery";
import { deployRoute } from "./routes/deploy";
import { deploymentDetailsRoute } from "./routes/deployments.$id";
import { settingsRoute } from "./routes/settings";

const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/",
  component: () => null,
  beforeLoad: async () => {
    const isAuthenticated = await api
      .me()
      .then(() => true)
      .catch(() => false);

    if (isAuthenticated) {
      throw redirect({ to: "/dashboard" });
    }

    throw redirect({ to: "/login" });
  }
});

const routeTree = rootRoute.addChildren([
  indexRoute,
  loginRoute,
  dashboardRoute,
  galleryRoute,
  deployRoute,
  deploymentDetailsRoute,
  settingsRoute
]);

const router = createRouter({
  routeTree,
  defaultPreload: "intent"
});

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  );
}
