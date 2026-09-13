import Fastify from "fastify";
import cookie from "@fastify/cookie";
import cors from "@fastify/cors";

import { prisma } from "./db.js";
import { env } from "./env.js";
import { bootstrapData } from "./services/bootstrap.js";
import { ensureSchema } from "./services/schema.js";
import { healthRoutes } from "./routes/health.js";
import { authRoutes } from "./routes/auth.js";
import { catalogRoutes } from "./routes/catalog.js";
import { deploymentRoutes } from "./routes/deployments.js";
import { agentRoutes } from "./routes/agent.js";

async function buildServer() {
  const app = Fastify({
    logger: true,
    trustProxy: true
  });

  await app.register(cors, {
    origin: true,
    credentials: true
  });

  await app.register(cookie, {
    secret: env.SESSION_SECRET,
    hook: "onRequest"
  });

  await app.register(async (api) => {
    await api.register(healthRoutes);
    await api.register(authRoutes);
    await api.register(catalogRoutes);
    await api.register(deploymentRoutes);
    await api.register(agentRoutes);
  }, { prefix: "/api" });

  return app;
}

async function start() {
  await ensureSchema();
  await bootstrapData();

  const app = await buildServer();

  const close = async () => {
    await app.close();
    await prisma.$disconnect();
    process.exit(0);
  };

  process.on("SIGINT", close);
  process.on("SIGTERM", close);

  await app.listen({
    port: env.PORT,
    host: "0.0.0.0"
  });
}

start().catch(async (error) => {
  console.error(error);
  await prisma.$disconnect();
  process.exit(1);
});
