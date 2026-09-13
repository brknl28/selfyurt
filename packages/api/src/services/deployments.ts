import { prisma } from "../db.js";

const HOSTNAME_REGEX = /^(?=.{1,253}$)(?!-)[a-z0-9-]+(?:\.[a-z0-9-]+)+$/;
const INSTANCE_ID_REGEX = /^[a-z0-9][a-z0-9-]{1,61}[a-z0-9]$/;

export function normalizeHostname(hostname: string): string {
  return hostname.trim().toLowerCase();
}

export function assertValidHostname(hostname: string): void {
  if (!HOSTNAME_REGEX.test(hostname)) {
    throw new Error("Invalid hostname format.");
  }
}

export function normalizeInstanceId(instanceId: string): string {
  return instanceId.trim().toLowerCase();
}

export function assertValidInstanceId(instanceId: string): void {
  if (!INSTANCE_ID_REGEX.test(instanceId)) {
    throw new Error("Invalid instanceId. Use lowercase alphanumeric and dashes (3-63 chars).");
  }
}

type DeploymentStatus = "DEPLOYING" | "RUNNING" | "STOPPED" | "ERROR";
type AccessType = "PUBLIC" | "INTERNAL";

type DeploymentWithRoute = {
  id: string;
  appId: string;
  instanceId: string;
  hostname: string | null;
  exposePublic: boolean;
  accessType: AccessType;
  internalEndpoint: string | null;
  status: DeploymentStatus;
  envJson: string;
  version: string | null;
  createdAt: Date;
  updatedAt: Date;
  route?: { target: string } | null;
};

export function toSerializableDeployment(deployment: DeploymentWithRoute) {
  const publicUrl = deployment.exposePublic && deployment.hostname ? `http://${deployment.hostname}` : null;

  return {
    id: deployment.id,
    appId: deployment.appId,
    instanceId: deployment.instanceId,
    hostname: deployment.hostname,
    exposePublic: deployment.exposePublic,
    accessType: deployment.accessType,
    internalEndpoint: deployment.internalEndpoint,
    publicUrl,
    status: deployment.status,
    env: JSON.parse(deployment.envJson) as Record<string, string>,
    version: deployment.version,
    createdAt: deployment.createdAt,
    updatedAt: deployment.updatedAt,
    routeTarget: deployment.route?.target ?? null
  };
}

export async function setDeploymentStatus(id: string, status: DeploymentStatus): Promise<void> {
  await prisma.deployment.update({
    where: { id },
    data: { status }
  });
}
