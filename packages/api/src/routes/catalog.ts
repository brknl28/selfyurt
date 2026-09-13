import type { FastifyPluginAsync } from "fastify";

import { getSessionUserId } from "../auth/session.js";
import { prisma } from "../db.js";
import { getCatalogWithManifests } from "../services/catalog.js";

export const catalogRoutes: FastifyPluginAsync = async (app) => {
  app.get("/catalog", async (request, reply) => {
    const userId = getSessionUserId(request);
    if (!userId) {
      return reply.code(401).send({ error: "Unauthorized" });
    }

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      return reply.code(401).send({ error: "Unauthorized" });
    }

    const catalog = await getCatalogWithManifests();

    return reply.send({
      items: catalog.map((item) => ({
        id: item.id,
        name: item.manifestData.name,
        category: item.category,
        manifest: item.manifest,
        description: item.manifestData.description,
        icon: item.manifestData.icon,
        ingress: item.manifestData.ingress,
        access: item.manifestData.access ?? {
          supportsPublic: true,
          defaultExposePublic: true,
          protocol: "http"
        },
        envSchema: item.manifestData.envSchema,
        notes: item.manifestData.notes
      }))
    });
  });
};
