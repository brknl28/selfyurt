import { Link, createRoute } from "@tanstack/react-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useState } from "react";

import { rootRoute } from "./__root";
import { requireAuth } from "@/lib/auth";
import { api } from "@/lib/api";
import { queryClient } from "@/lib/queryClient";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

function statusVariant(status: string): "default" | "secondary" | "destructive" | "outline" {
  switch (status) {
    case "RUNNING":
      return "default";
    case "STOPPED":
      return "secondary";
    case "ERROR":
      return "destructive";
    default:
      return "outline";
  }
}

function DashboardPage() {
  const [actionError, setActionError] = useState<string | null>(null);

  const metricsQuery = useQuery({
    queryKey: ["metrics"],
    queryFn: () => api.metrics(),
    refetchInterval: 10000
  });

  const deploymentsQuery = useQuery({
    queryKey: ["deployments"],
    queryFn: async () => (await api.deployments()).items
  });

  const actionMutation = useMutation({
    mutationFn: async ({ id, action }: { id: string; action: "start" | "stop" | "update" | "uninstall" }) => {
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
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["deployments"] });
      setActionError(null);
    },
    onError: (error: Error) => {
      setActionError(error.message);
    }
  });

  return (
    <div className="space-y-6">
      <section className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>CPU</CardTitle>
          </CardHeader>
          <CardContent>{metricsQuery.data ? `${metricsQuery.data.cpuPercent.toFixed(1)}%` : "-"}</CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Memory</CardTitle>
          </CardHeader>
          <CardContent>{metricsQuery.data ? `${metricsQuery.data.memoryPercent.toFixed(1)}%` : "-"}</CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Disk</CardTitle>
          </CardHeader>
          <CardContent>{metricsQuery.data ? `${metricsQuery.data.diskPercent.toFixed(1)}%` : "-"}</CardContent>
        </Card>
      </section>

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold">Deployments</h2>
          <Button asChild>
            <Link to="/gallery">Deploy new app</Link>
          </Button>
        </div>

        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>App</TableHead>
                  <TableHead>Instance</TableHead>
                  <TableHead>Access</TableHead>
                  <TableHead>Endpoint</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {deploymentsQuery.data?.map((deployment) => (
                  <TableRow key={deployment.id}>
                    <TableCell>{deployment.appId}</TableCell>
                    <TableCell>{deployment.instanceId}</TableCell>
                    <TableCell>
                      <Badge variant={deployment.accessType === "PUBLIC" ? "default" : "secondary"}>
                        {deployment.accessType}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {deployment.publicUrl ? (
                        <a href={deployment.publicUrl} target="_blank" rel="noreferrer" className="text-primary underline">
                          {deployment.hostname}
                        </a>
                      ) : (
                        <span className="text-xs text-muted-foreground">
                          {deployment.internalEndpoint ?? "Internal service only"}
                        </span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant={statusVariant(deployment.status)}>{deployment.status}</Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex flex-wrap justify-end gap-2">
                        {deployment.publicUrl ? (
                          <Button size="sm" variant="outline" asChild>
                            <a href={deployment.publicUrl} target="_blank" rel="noreferrer">
                              Open
                            </a>
                          </Button>
                        ) : null}
                        <Button size="sm" variant="outline" asChild>
                          <Link to="/deployments/$id" params={{ id: deployment.id }}>
                            Logs
                          </Link>
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => actionMutation.mutate({ id: deployment.id, action: "start" })}
                          disabled={actionMutation.isPending}
                        >
                          Start
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => actionMutation.mutate({ id: deployment.id, action: "stop" })}
                          disabled={actionMutation.isPending}
                        >
                          Stop
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => actionMutation.mutate({ id: deployment.id, action: "update" })}
                          disabled={actionMutation.isPending}
                        >
                          Update
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => actionMutation.mutate({ id: deployment.id, action: "uninstall" })}
                          disabled={actionMutation.isPending}
                        >
                          Uninstall
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>

            {deploymentsQuery.data?.length === 0 ? (
              <div className="p-6 text-sm text-muted-foreground">No deployments yet.</div>
            ) : null}
          </CardContent>
        </Card>
        {actionError ? <p className="text-sm text-destructive">{actionError}</p> : null}
      </section>
    </div>
  );
}

export const dashboardRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/dashboard",
  component: DashboardPage,
  beforeLoad: requireAuth
});
