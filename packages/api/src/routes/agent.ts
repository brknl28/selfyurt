import type { FastifyPluginAsync } from "fastify";

import { getSessionUserId } from "../auth/session.js";
import { prisma } from "../db.js";
import { agentProvider } from "../services/agentProvider.js";

export const agentRoutes: FastifyPluginAsync = async (app) => {
  app.get("/metrics", async (request, reply) => {
    const userId = getSessionUserId(request);
    if (!userId) {
      return reply.code(401).send({ error: "Unauthorized" });
    }

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      return reply.code(401).send({ error: "Unauthorized" });
    }

    const metrics = await agentProvider.metrics();
    return reply.send(metrics);
  });

  app.get("/settings", async (request, reply) => {
    const userId = getSessionUserId(request);
    if (!userId) {
      return reply.code(401).send({ error: "Unauthorized" });
    }

    const settings = await prisma.settings.findUnique({ where: { id: "singleton" } });
    return reply.send({
      baseDomain: settings?.baseDomain ?? null
    });
  });

  app.put("/settings", async (request, reply) => {
    const userId = getSessionUserId(request);
    if (!userId) {
      return reply.code(401).send({ error: "Unauthorized" });
    }

    const body = request.body as { baseDomain?: string | null };

    const settings = await prisma.settings.upsert({
      where: { id: "singleton" },
      update: {
        baseDomain: body.baseDomain?.trim() || null
      },
      create: {
        id: "singleton",
        baseDomain: body.baseDomain?.trim() || null
      }
    });

    return reply.send({ baseDomain: settings.baseDomain });
  });
};
