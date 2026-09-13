import { createRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useState } from "react";

import { rootRoute } from "./__root";
import { requireAuth } from "@/lib/auth";
import { api } from "@/lib/api";
import { queryClient } from "@/lib/queryClient";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";

function DeploymentDetailsPage() {
  const navigate = useNavigate();
  const { id } = deploymentDetailsRoute.useParams();
  const [actionError, setActionError] = useState<string | null>(null);

  const deploymentQuery = useQuery({
    queryKey: ["deployment", id],
    queryFn: async () => (await api.deployment(id)).deployment
  });

  const logsQuery = useQuery({
    queryKey: ["logs", id],
    queryFn: async () => (await api.deploymentLogs(id, 200)).logs,
    refetchInterval: 5000
  });

  const actionMutation = useMutation({
    mutationFn: async (action: "start" | "stop" | "update" | "uninstall") => {
      if (action === "start") {
        return api.startDeployment(id);
      }
      if (action === "stop") {
        return api.stopDeployment(id);
      }
      if (action === "update") {
        return api.updateDeployment(id);
      }
      return api.uninstallDeployment(id);
    },
    onMutate: () => {
      setActionError(null);
    },
    onSuccess: async (_result, action) => {
      await queryClient.invalidateQueries({ queryKey: ["deployments"] });
      await queryClient.invalidateQueries({ queryKey: ["deployment", id] });
      setActionError(null);
      if (action === "uninstall") {
        navigate({ to: "/dashboard" });
      }
    },
    onError: (error: Error) => {
      setActionError(error.message);
    }
  });

  const deployment = deploymentQuery.data;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>{deployment?.instanceId ?? "Deployment"}</CardTitle>
          <CardDescription>{deployment?.appId ?? "-"}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <Badge>{deployment?.status ?? "-"}</Badge>
            <Badge variant={deployment?.accessType === "PUBLIC" ? "default" : "secondary"}>
              {deployment?.accessType ?? "-"}
            </Badge>
            {deployment?.publicUrl ? (
              <a href={deployment.publicUrl} target="_blank" rel="noreferrer" className="text-primary underline">
                Open app
              </a>
            ) : null}
          </div>

          {deployment?.publicUrl ? (
            <p className="text-sm text-muted-foreground">Public URL: {deployment.publicUrl}</p>
          ) : (
            <p className="text-sm text-muted-foreground">
              Internal endpoint: {deployment?.internalEndpoint ?? "Not available"}
            </p>
          )}

          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => actionMutation.mutate("start")} disabled={actionMutation.isPending}>
              Start
            </Button>
            <Button variant="outline" onClick={() => actionMutation.mutate("stop")} disabled={actionMutation.isPending}>
              Stop
            </Button>
            <Button variant="outline" onClick={() => actionMutation.mutate("update")} disabled={actionMutation.isPending}>
              Update
            </Button>
            <Button variant="destructive" onClick={() => actionMutation.mutate("uninstall")} disabled={actionMutation.isPending}>
              Uninstall
            </Button>
          </div>

          {actionError ? <p className="text-sm text-destructive">{actionError}</p> : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Logs</CardTitle>
          <CardDescription>Last 200 lines</CardDescription>
        </CardHeader>
        <CardContent>
          <Textarea value={logsQuery.data ?? ""} readOnly className="min-h-[360px]" />
          {logsQuery.error ? (
            <p className="mt-2 text-sm text-destructive">{(logsQuery.error as Error).message}</p>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}

export const deploymentDetailsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/deployments/$id",
  component: DeploymentDetailsPage,
  beforeLoad: requireAuth
});
