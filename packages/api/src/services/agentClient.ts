import { env } from "../env.js";
import type { AgentMetrics } from "../types.js";
import type { AgentDeployInput, AgentDeployResult, AgentProvider } from "./agentTypes.js";

type AgentRequestInit = {
  method?: "GET" | "POST" | "DELETE";
  body?: unknown;
};

export class RealAgentClient implements AgentProvider {
  constructor(
    private readonly baseUrl: string,
    private readonly token: string
  ) {}

  private async request<T>(path: string, init: AgentRequestInit = {}): Promise<T> {
    const response = await fetch(`${this.baseUrl}${path}`, {
      method: init.method ?? "GET",
      headers: {
        "Content-Type": "application/json",
        "X-SELFYURT-TOKEN": this.token
      },
      body: init.body ? JSON.stringify(init.body) : undefined
    });

    if (!response.ok) {
      const message = await response.text();
      throw new Error(`Agent request failed (${response.status}): ${message}`);
    }

    if (response.status === 204) {
      return undefined as T;
    }

    const contentType = response.headers.get("content-type") ?? "";
    if (contentType.includes("application/json")) {
      return (await response.json()) as T;
    }

    return (await response.text()) as T;
  }

  async health(): Promise<{ ok: boolean }> {
    return this.request<{ ok: boolean }>("/health");
  }

  async metrics(): Promise<AgentMetrics> {
    return this.request<AgentMetrics>("/metrics");
  }

  async deploy(payload: AgentDeployInput): Promise<AgentDeployResult> {
    return this.request<AgentDeployResult>("/deploy", {
      method: "POST",
      body: payload
    });
  }

  async stop(instanceId: string): Promise<{ ok: boolean }> {
    return this.request<{ ok: boolean }>("/stop", {
      method: "POST",
      body: { instanceId }
    });
  }

  async start(instanceId: string): Promise<{ ok: boolean }> {
    return this.request<{ ok: boolean }>("/start", {
      method: "POST",
      body: { instanceId }
    });
  }

  async update(instanceId: string): Promise<{ ok: boolean }> {
    return this.request<{ ok: boolean }>("/update", {
      method: "POST",
      body: { instanceId }
    });
  }

  async uninstall(instanceId: string, removeVolumes = false): Promise<{ ok: boolean }> {
    return this.request<{ ok: boolean }>("/uninstall", {
      method: "DELETE",
      body: { instanceId, removeVolumes }
    });
  }

  async logs(instanceId: string, tail = 200): Promise<{ logs: string }> {
    const query = new URLSearchParams({
      instanceId,
      tail: String(tail)
    });

    return this.request<{ logs: string }>(`/logs?${query.toString()}`);
  }
}

export const agentClient = new RealAgentClient(env.AGENT_URL, env.AGENT_TOKEN);
