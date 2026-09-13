import { env } from "../env.js";

import { RealAgentClient } from "./agentClient.js";
import { MockAgentClient } from "./mockAgentClient.js";
import type { AgentProvider } from "./agentTypes.js";

export const agentProvider: AgentProvider =
  env.AGENT_MODE === "mock"
    ? new MockAgentClient(env.MOCK_AGENT_STATE_FILE)
    : new RealAgentClient(env.AGENT_URL, env.AGENT_TOKEN);
