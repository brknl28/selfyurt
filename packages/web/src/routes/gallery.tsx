import { Link, createRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";

import { rootRoute } from "./__root";
import { requireAuth } from "@/lib/auth";
import { api } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

function GalleryPage() {
  const catalogQuery = useQuery({
    queryKey: ["catalog"],
    queryFn: async () => (await api.catalog()).items
  });

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">App Gallery</h1>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {catalogQuery.data?.map((app) => (
          <Card key={app.id}>
            <CardHeader>
              <CardTitle>{app.name}</CardTitle>
              <CardDescription className="flex items-center justify-between gap-2">
                <span>{app.category}</span>
                <Badge variant={app.access.supportsPublic ? "default" : "secondary"}>
                  {app.access.supportsPublic ? "Public HTTP" : "Internal Only"}
                </Badge>
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">{app.description}</p>
              <Button asChild className="w-full">
                <Link to="/deploy/$appId" params={{ appId: app.id }}>
                  Deploy
                </Link>
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

export const galleryRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/gallery",
  component: GalleryPage,
  beforeLoad: requireAuth
});
