import type { CatalogItem, Deployment, Metrics, Settings, User } from "./types";

const API_BASE = import.meta.env.VITE_API_BASE || "/api";

export class ApiError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(init.headers || {})
    },
    ...init
  });

  if (!response.ok) {
    const payload = await response.json().catch(() => null);
    const message = payload?.error ?? `Request failed with status ${response.status}`;
    throw new ApiError(response.status, message);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}

export const api = {
  login(payload: { email: string; password: string }) {
    return request<{ user: User }>("/auth/login", {
      method: "POST",
      body: JSON.stringify(payload)
    });
  },

  logout() {
    return request<{ ok: true }>("/auth/logout", {
      method: "POST"
    });
  },

  me() {
    return request<{ user: User }>("/auth/me");
  },

  health() {
    return request<{ ok: true }>("/health");
  },

  catalog() {
    return request<{ items: CatalogItem[] }>("/catalog");
  },

  deployments() {
    return request<{ items: Deployment[] }>("/deployments");
  },

  deployment(id: string) {
    return request<{ deployment: Deployment }>(`/deployments/${id}`);
  },

  createDeployment(payload: {
    appId: string;
    instanceId: string;
    hostname?: string | null;
    exposePublic?: boolean;
    env: Record<string, string>;
  }) {
    return request<{ deployment: Deployment }>("/deployments", {
      method: "POST",
      body: JSON.stringify(payload)
    });
  },

  stopDeployment(id: string) {
    return request<{ ok: true }>(`/deployments/${id}/stop`, {
      method: "POST"
    });
  },

  startDeployment(id: string) {
    return request<{ ok: true }>(`/deployments/${id}/start`, {
      method: "POST"
    });
  },

  updateDeployment(id: string) {
    return request<{ ok: true }>(`/deployments/${id}/update`, {
      method: "POST"
    });
  },

  uninstallDeployment(id: string, removeVolumes = false) {
    return request<{ ok: true }>(`/deployments/${id}`, {
      method: "DELETE",
      body: JSON.stringify({ removeVolumes })
    });
  },

  deploymentLogs(id: string, tail = 200) {
    return request<{ logs: string }>(`/deployments/${id}/logs?tail=${tail}`);
  },

  metrics() {
    return request<Metrics>("/metrics");
  },

  settings() {
    return request<Settings>("/settings");
  },

  updateSettings(payload: Settings) {
    return request<Settings>("/settings", {
      method: "PUT",
      body: JSON.stringify(payload)
    });
  }
};
