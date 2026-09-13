import { useEffect, useMemo, useState } from "react";
import { createRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery } from "@tanstack/react-query";

import { rootRoute } from "./__root";
import { requireAuth } from "@/lib/auth";
import { api } from "@/lib/api";
import { queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

function DeployPage() {
  const navigate = useNavigate();
  const { appId } = deployRoute.useParams();

  const catalogQuery = useQuery({
    queryKey: ["catalog"],
    queryFn: async () => (await api.catalog()).items
  });

  const settingsQuery = useQuery({
    queryKey: ["settings"],
    queryFn: () => api.settings()
  });

  const app = useMemo(() => catalogQuery.data?.find((item) => item.id === appId), [catalogQuery.data, appId]);

  const [instanceId, setInstanceId] = useState("");
  const [hostname, setHostname] = useState("");
  const [exposePublic, setExposePublic] = useState(true);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [envValues, setEnvValues] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!app) {
      return;
    }

    setExposePublic(app.access.defaultExposePublic);
    setSubmitError(null);

    const nextEnvValues: Record<string, string> = {};
    for (const field of app.envSchema) {
      nextEnvValues[field.key] = field.default ?? "";
    }
    setEnvValues(nextEnvValues);
  }, [app]);

  const deployMutation = useMutation({
    mutationFn: () =>
      api.createDeployment({
        appId,
        instanceId,
        hostname: exposePublic ? hostname : null,
        exposePublic,
        env: envValues
      }),
    onSuccess: async ({ deployment }) => {
      await queryClient.invalidateQueries({ queryKey: ["deployments"] });
      navigate({ to: "/deployments/$id", params: { id: deployment.id } });
    },
    onError: (error: Error) => {
      setSubmitError(error.message);
    }
  });

  const baseDomain = settingsQuery.data?.baseDomain ?? "";
  const supportsPublic = app?.access.supportsPublic ?? true;

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Deploy {app?.name ?? appId}</CardTitle>
          <CardDescription>{app?.description ?? "Configure and deploy this app."}</CardDescription>
        </CardHeader>
        <CardContent>
          <form
            className="space-y-4"
            onSubmit={(event) => {
              event.preventDefault();

              const normalizedInstanceId = instanceId.trim().toLowerCase();
              if (!normalizedInstanceId) {
                setSubmitError("Instance ID is required.");
                return;
              }

              for (const field of app?.envSchema ?? []) {
                const value = (envValues[field.key] ?? "").trim();
                if (field.required && !value) {
                  setSubmitError(`${field.label} is required.`);
                  return;
                }
              }

              if (supportsPublic && exposePublic && !hostname.trim()) {
                setSubmitError("Hostname is required when public exposure is enabled.");
                return;
              }

              setSubmitError(null);
              deployMutation.mutate();
            }}
          >
            <div className="space-y-2">
              <Label htmlFor="instanceId">Instance ID</Label>
              <Input
                id="instanceId"
                placeholder="hello-main"
                value={instanceId}
                onChange={(event) => setInstanceId(event.target.value)}
              />
            </div>

            {supportsPublic ? (
              <div className="space-y-2">
                <Label htmlFor="exposePublic">Expose Publicly</Label>
                <div className="flex items-center gap-2">
                  <input
                    id="exposePublic"
                    type="checkbox"
                    checked={exposePublic}
                    onChange={(event) => setExposePublic(event.target.checked)}
                  />
                  <span className="text-sm text-muted-foreground">Enable public hostname via Caddy</span>
                </div>
              </div>
            ) : (
              <div className="text-sm text-muted-foreground">
                This app is internal-only in MVP. It will not be exposed to the public internet.
              </div>
            )}

            {supportsPublic && exposePublic ? (
              <div className="space-y-2">
                <Label htmlFor="hostname">Hostname</Label>
                <Input
                  id="hostname"
                  placeholder={baseDomain ? `hello.${baseDomain}` : "hello.127.0.0.1.nip.io"}
                  value={hostname}
                  onChange={(event) => setHostname(event.target.value)}
                />
              </div>
            ) : null}

            {app?.envSchema.map((field) => (
              <div className="space-y-2" key={field.key}>
                <Label htmlFor={`env-${field.key}`}>{field.label}</Label>
                <Input
                  id={`env-${field.key}`}
                  type={field.secret ? "password" : "text"}
                  value={envValues[field.key] ?? field.default ?? ""}
                  onChange={(event) => {
                    setEnvValues((prev) => ({
                      ...prev,
                      [field.key]: event.target.value
                    }));
                  }}
                />
              </div>
            ))}

            {submitError ? <p className="text-sm text-destructive">{submitError}</p> : null}

            <Button type="submit" disabled={deployMutation.isPending}>
              {deployMutation.isPending ? "Deploying..." : "Deploy"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

export const deployRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/deploy/$appId",
  component: DeployPage,
  beforeLoad: requireAuth
});
