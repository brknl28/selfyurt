import { useState } from "react";
import { createRoute } from "@tanstack/react-router";
import { useMutation, useQuery } from "@tanstack/react-query";

import { rootRoute } from "./__root";
import { requireAuth } from "@/lib/auth";
import { api } from "@/lib/api";
import { queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

function SettingsPage() {
  const settingsQuery = useQuery({
    queryKey: ["settings"],
    queryFn: () => api.settings()
  });

  const [baseDomain, setBaseDomain] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: () => api.updateSettings({ baseDomain: (baseDomain ?? "").trim() || null }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["settings"] });
      setBaseDomain(null);
    }
  });

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Domain Settings</CardTitle>
          <CardDescription>Optional helper for hostname suggestions in deploy forms.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="baseDomain">Base Domain</Label>
            <Input
              id="baseDomain"
              value={baseDomain ?? settingsQuery.data?.baseDomain ?? ""}
              onChange={(event) => setBaseDomain(event.target.value)}
              placeholder="example.com"
            />
          </div>
          <Button onClick={() => mutation.mutate()} disabled={mutation.isPending}>
            Save
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>DNS Guidance</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p>1. Create A record: panel.yourdomain.com to VPS IP</p>
          <p>2. Create A record per app hostname to the same VPS IP</p>
          <p>3. Optional: wildcard *.yourdomain.com to VPS IP</p>
        </CardContent>
      </Card>
    </div>
  );
}

export const settingsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/settings",
  component: SettingsPage,
  beforeLoad: requireAuth
});
