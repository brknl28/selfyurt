export type User = {
  id: string;
  email: string;
  createdAt: string;
};

export type EnvSchemaField = {
  key: string;
  label: string;
  required: boolean;
  default?: string;
  secret?: boolean;
};

export type CatalogItem = {
  id: string;
  name: string;
  category: string;
  manifest: string;
  description: string;
  icon?: string;
  ingress: {
    targetService: string;
    targetPort: number;
  };
  access: {
    defaultExposePublic: boolean;
    supportsPublic: boolean;
    protocol: "http" | "tcp";
  };
  envSchema: EnvSchemaField[];
  notes?: string;
};

export type DeploymentStatus = "DEPLOYING" | "RUNNING" | "STOPPED" | "ERROR";

export type Deployment = {
  id: string;
  appId: string;
  instanceId: string;
  hostname: string | null;
  exposePublic: boolean;
  accessType: "PUBLIC" | "INTERNAL";
  internalEndpoint: string | null;
  publicUrl: string | null;
  status: DeploymentStatus;
  env: Record<string, string>;
  version: string | null;
  routeTarget: string | null;
  createdAt: string;
  updatedAt: string;
};

export type Metrics = {
  cpuPercent: number;
  memoryPercent: number;
  diskPercent: number;
};

export type Settings = {
  baseDomain: string | null;
};
