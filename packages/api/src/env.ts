import { z } from "zod";

const schema = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  PORT: z.coerce.number().default(8787),
  DATABASE_URL: z.string().default("file:./selfyurt.db"),
  AGENT_MODE: z.enum(["real", "mock"]).default("real"),
  AGENT_URL: z.string().url().default("http://agent:7070"),
  AGENT_TOKEN: z.string().min(8).default("dev-agent-token"),
  MOCK_AGENT_STATE_FILE: z.string().default("/tmp/selfyurt-mock-agent.json"),
  SESSION_SECRET: z.string().min(16).default("dev-session-secret-please-change"),
  ADMIN_EMAIL: z.string().email().default("admin@example.com"),
  ADMIN_PASSWORD: z.string().min(8).default("change-me-now"),
  BASE_DOMAIN: z.string().optional(),
  CATALOG_DIR: z.string().default("/opt/selfyurt/apps/catalog"),
  COOKIE_SECURE: z
    .string()
    .optional()
    .transform((value) => value === "true")
});

const parsed = schema.parse(process.env);

export const env = {
  ...parsed,
  COOKIE_SECURE: parsed.COOKIE_SECURE ?? parsed.NODE_ENV === "production"
};
