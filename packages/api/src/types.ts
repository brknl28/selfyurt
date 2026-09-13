export type JsonObject = Record<string, string>;

export type AgentMetrics = {
  cpuPercent: number;
  memoryPercent: number;
  diskPercent: number;
};

export type AgentDeployResponse = {
  target: string;
  ingressPort: number;
  internalEndpoint?: string | null;
};
