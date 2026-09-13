import type { AgentMetrics, JsonObject } from "../types.js";

export type AgentDeployInput = {
  appId: string;
  instanceId: string;
  hostname?: string | null;
  exposePublic: boolean;
  env: JsonObject;
};

export type AgentDeployResult = {
  target: string;
  ingressPort: number;
  internalEndpoint?: string | null;
};

export interface AgentProvider {
  health(): Promise<{ ok: boolean }>;
  metrics(): Promise<AgentMetrics>;
  deploy(payload: AgentDeployInput): Promise<AgentDeployResult>;
  stop(instanceId: string): Promise<{ ok: boolean }>;
  start(instanceId: string): Promise<{ ok: boolean }>;
  update(instanceId: string): Promise<{ ok: boolean }>;
  uninstall(instanceId: string, removeVolumes?: boolean): Promise<{ ok: boolean }>;
  logs(instanceId: string, tail?: number): Promise<{ logs: string }>;
}
