import { promises as fs } from "node:fs";

import type { AgentProvider, AgentDeployInput, AgentDeployResult } from "./agentTypes.js";
import type { AgentMetrics } from "../types.js";

type MockDeploymentState = {
  appId: string;
  instanceId: string;
  status: "RUNNING" | "STOPPED";
  exposePublic: boolean;
  hostname: string | null;
  target: string;
  internalEndpoint: string | null;
  logs: string[];
  updatedAt: string;
};

type MockState = {
  deployments: Record<string, MockDeploymentState>;
};

const DEFAULT_STATE: MockState = {
  deployments: {}
};

const SERVICE_MAP: Record<string, { service: string; port: number }> = {
  "nginx-hello": { service: "app", port: 80 },
  postgres: { service: "db", port: 5432 },
  redis: { service: "redis", port: 6379 }
};

export class MockAgentClient implements AgentProvider {
  constructor(private readonly stateFile: string) {}

  private async readState(): Promise<MockState> {
    try {
      const content = await fs.readFile(this.stateFile, "utf8");
      const parsed = JSON.parse(content) as MockState;
      return {
        deployments: parsed.deployments ?? {}
      };
    } catch {
      return DEFAULT_STATE;
    }
  }

  private async writeState(state: MockState): Promise<void> {
    await fs.writeFile(this.stateFile, JSON.stringify(state, null, 2), "utf8");
  }

  private nowIso(): string {
    return new Date().toISOString();
  }

  private buildTarget(appId: string, instanceId: string): { target: string; port: number } {
    const service = SERVICE_MAP[appId] ?? { service: "app", port: 80 };
    return {
      target: `sy-${instanceId}-${service.service}:${service.port}`,
      port: service.port
    };
  }

  async health(): Promise<{ ok: boolean }> {
    return { ok: true };
  }

  async metrics(): Promise<AgentMetrics> {
    return {
      cpuPercent: 22.1,
      memoryPercent: 43.7,
      diskPercent: 58.3
    };
  }

  async deploy(payload: AgentDeployInput): Promise<AgentDeployResult> {
    const state = await this.readState();

    const built = this.buildTarget(payload.appId, payload.instanceId);

    const entry: MockDeploymentState = {
      appId: payload.appId,
      instanceId: payload.instanceId,
      status: "RUNNING",
      exposePublic: payload.exposePublic,
      hostname: payload.hostname?.trim() || null,
      target: built.target,
      internalEndpoint: payload.exposePublic ? null : built.target,
      logs: [
        `${this.nowIso()} [mock-agent] deploying ${payload.instanceId}`,
        `${this.nowIso()} [mock-agent] status=running`
      ],
      updatedAt: this.nowIso()
    };

    state.deployments[payload.instanceId] = entry;
    await this.writeState(state);

    return {
      target: built.target,
      ingressPort: built.port,
      internalEndpoint: entry.internalEndpoint
    };
  }

  async stop(instanceId: string): Promise<{ ok: boolean }> {
    const state = await this.readState();
    const deployment = state.deployments[instanceId];
    if (deployment) {
      deployment.status = "STOPPED";
      deployment.logs.push(`${this.nowIso()} [mock-agent] stop`);
      deployment.updatedAt = this.nowIso();
      await this.writeState(state);
    }

    return { ok: true };
  }

  async start(instanceId: string): Promise<{ ok: boolean }> {
    const state = await this.readState();
    const deployment = state.deployments[instanceId];
    if (deployment) {
      deployment.status = "RUNNING";
      deployment.logs.push(`${this.nowIso()} [mock-agent] start`);
      deployment.updatedAt = this.nowIso();
      await this.writeState(state);
    }

    return { ok: true };
  }

  async update(instanceId: string): Promise<{ ok: boolean }> {
    const state = await this.readState();
    const deployment = state.deployments[instanceId];
    if (deployment) {
      deployment.status = "RUNNING";
      deployment.logs.push(`${this.nowIso()} [mock-agent] update images + restart`);
      deployment.updatedAt = this.nowIso();
      await this.writeState(state);
    }

    return { ok: true };
  }

  async uninstall(instanceId: string): Promise<{ ok: boolean }> {
    const state = await this.readState();
    delete state.deployments[instanceId];
    await this.writeState(state);
    return { ok: true };
  }

  async logs(instanceId: string, tail = 200): Promise<{ logs: string }> {
    const state = await this.readState();
    const deployment = state.deployments[instanceId];

    if (!deployment) {
      return {
        logs: `${this.nowIso()} [mock-agent] no logs found for instance ${instanceId}`
      };
    }

    const safeTail = Number.isFinite(tail) && tail > 0 ? tail : 200;
    return {
      logs: deployment.logs.slice(-safeTail).join("\n")
    };
  }
}
