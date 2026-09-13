import type { FastifyPluginAsync, FastifyRequest } from "fastify";
import { z } from "zod";

import { getSessionUserId } from "../auth/session.js";
import { prisma } from "../db.js";
import { agentProvider } from "../services/agentProvider.js";
import { findManifestByAppId } from "../services/catalog.js";
import {
  assertValidHostname,
  assertValidInstanceId,
  normalizeHostname,
  normalizeInstanceId,
  setDeploymentStatus,
  toSerializableDeployment
} from "../services/deployments.js";

const createDeploymentSchema = z.object({
  appId: z.string().min(1),
  instanceId: z.string().min(3),
  hostname: z.string().nullable().optional(),
  exposePublic: z.boolean().optional(),
  env: z.record(z.string()).default({})
});

const actionSchema = z.object({
  removeVolumes: z.boolean().optional().default(false)
});

async function requireUserId(request: FastifyRequest) {
  const userId = getSessionUserId(request);
  if (!userId) {
    return null;
  }

  const user = await prisma.user.findUnique({ where: { id: userId } });
  return user ? user.id : null;
}

export const deploymentRoutes: FastifyPluginAsync = async (app) => {
  app.get("/deployments", async (request, reply) => {
    const userId = await requireUserId(request);
    if (!userId) {
      return reply.code(401).send({ error: "Unauthorized" });
    }

    const deployments = await prisma.deployment.findMany({
      include: { route: true },
      orderBy: { createdAt: "desc" }
    });

    return reply.send({
      items: deployments.map(toSerializableDeployment)
    });
  });

  app.get("/deployments/:id", async (request, reply) => {
    const userId = await requireUserId(request);
    if (!userId) {
      return reply.code(401).send({ error: "Unauthorized" });
    }

    const params = request.params as { id: string };

    const deployment = await prisma.deployment.findUnique({
      where: { id: params.id },
      include: { route: true }
    });

    if (!deployment) {
      return reply.code(404).send({ error: "Deployment not found." });
    }

    return reply.send({ deployment: toSerializableDeployment(deployment) });
  });

  app.post("/deployments", async (request, reply) => {
    const userId = await requireUserId(request);
    if (!userId) {
      return reply.code(401).send({ error: "Unauthorized" });
    }

    const parsed = createDeploymentSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: "Invalid request payload." });
    }

    const appId = parsed.data.appId;
    const instanceId = normalizeInstanceId(parsed.data.instanceId);

    try {
      assertValidInstanceId(instanceId);
    } catch (error) {
      return reply.code(400).send({ error: (error as Error).message });
    }

    const manifest = await findManifestByAppId(appId);
    if (!manifest) {
      return reply.code(404).send({ error: "Unknown appId." });
    }

    const supportsPublic = manifest.access?.supportsPublic ?? true;
    const defaultExposePublic = manifest.access?.defaultExposePublic ?? supportsPublic;
    const exposePublic = parsed.data.exposePublic ?? defaultExposePublic;

    if (exposePublic && !supportsPublic) {
      return reply.code(400).send({ error: `${appId} does not support public exposure in MVP.` });
    }

    let hostname: string | null = null;
    if (exposePublic) {
      hostname = normalizeHostname(parsed.data.hostname ?? "");
      if (!hostname) {
        return reply.code(400).send({ error: "hostname is required when exposePublic=true" });
      }

      try {
        assertValidHostname(hostname);
      } catch (error) {
        return reply.code(400).send({ error: (error as Error).message });
      }
    }

    const existing = await prisma.deployment.findFirst({
      where: hostname
        ? {
            OR: [{ instanceId }, { hostname }]
          }
        : {
            instanceId
          }
    });

    if (existing) {
      return reply.code(409).send({ error: "instanceId or hostname already in use." });
    }

    const deployment = await prisma.deployment.create({
      data: {
        appId,
        instanceId,
        hostname,
        exposePublic,
        accessType: exposePublic ? "PUBLIC" : "INTERNAL",
        internalEndpoint: null,
        status: "DEPLOYING",
        envJson: JSON.stringify(parsed.data.env),
        version: null
      },
      include: { route: true }
    });

    try {
      const deployResult = await agentProvider.deploy({
        appId,
        instanceId,
        hostname,
        exposePublic,
        env: parsed.data.env
      });

      if (exposePublic && hostname) {
        await prisma.route.upsert({
          where: { deploymentId: deployment.id },
          update: {
            hostname,
            target: deployResult.target
          },
          create: {
            hostname,
            target: deployResult.target,
            deploymentId: deployment.id
          }
        });
      }

      await prisma.deployment.update({
        where: { id: deployment.id },
        data: {
          status: "RUNNING",
          internalEndpoint: exposePublic ? null : deployResult.internalEndpoint ?? deployResult.target
        }
      });

      await prisma.auditLog.create({
        data: {
          action: "deployment.create",
          payloadJson: JSON.stringify({
            deploymentId: deployment.id,
            appId,
            instanceId,
            hostname,
            exposePublic,
            target: deployResult.target,
            internalEndpoint: deployResult.internalEndpoint ?? null,
            ingressPort: deployResult.ingressPort,
            requestedBy: userId
          })
        }
      });

      const updated = await prisma.deployment.findUnique({
        where: { id: deployment.id },
        include: { route: true }
      });

      if (!updated) {
        throw new Error("Deployment persisted but could not be reloaded.");
      }

      return reply.code(201).send({
        deployment: toSerializableDeployment(updated)
      });
    } catch (error) {
      await setDeploymentStatus(deployment.id, "ERROR");
      return reply.code(502).send({
        error: "Agent deploy failed.",
        details: (error as Error).message
      });
    }
  });

  app.post("/deployments/:id/start", async (request, reply) => {
    const userId = await requireUserId(request);
    if (!userId) {
      return reply.code(401).send({ error: "Unauthorized" });
    }

    const { id } = request.params as { id: string };
    const deployment = await prisma.deployment.findUnique({ where: { id } });
    if (!deployment) {
      return reply.code(404).send({ error: "Deployment not found." });
    }

    await agentProvider.start(deployment.instanceId);
    await setDeploymentStatus(id, "RUNNING");

    return reply.send({ ok: true });
  });

  app.post("/deployments/:id/stop", async (request, reply) => {
    const userId = await requireUserId(request);
    if (!userId) {
      return reply.code(401).send({ error: "Unauthorized" });
    }

    const { id } = request.params as { id: string };
    const deployment = await prisma.deployment.findUnique({ where: { id } });
    if (!deployment) {
      return reply.code(404).send({ error: "Deployment not found." });
    }

    await agentProvider.stop(deployment.instanceId);
    await setDeploymentStatus(id, "STOPPED");

    return reply.send({ ok: true });
  });

  app.post("/deployments/:id/update", async (request, reply) => {
    const userId = await requireUserId(request);
    if (!userId) {
      return reply.code(401).send({ error: "Unauthorized" });
    }

    const { id } = request.params as { id: string };
    const deployment = await prisma.deployment.findUnique({ where: { id } });
    if (!deployment) {
      return reply.code(404).send({ error: "Deployment not found." });
    }

    await agentProvider.update(deployment.instanceId);
    await setDeploymentStatus(id, "RUNNING");

    return reply.send({ ok: true });
  });

  app.delete("/deployments/:id", async (request, reply) => {
    const userId = await requireUserId(request);
    if (!userId) {
      return reply.code(401).send({ error: "Unauthorized" });
    }

    const { id } = request.params as { id: string };
    const parsed = actionSchema.safeParse(request.body ?? {});
    if (!parsed.success) {
      return reply.code(400).send({ error: "Invalid request payload." });
    }

    const deployment = await prisma.deployment.findUnique({ where: { id } });
    if (!deployment) {
      return reply.code(404).send({ error: "Deployment not found." });
    }

    await agentProvider.uninstall(deployment.instanceId, parsed.data.removeVolumes);

    await prisma.auditLog.create({
      data: {
        action: "deployment.uninstall",
        payloadJson: JSON.stringify({
          deploymentId: id,
          instanceId: deployment.instanceId,
          removeVolumes: parsed.data.removeVolumes,
          requestedBy: userId
        })
      }
    });
    await prisma.deployment.delete({ where: { id } });

    return reply.send({ ok: true });
  });

  app.get("/deployments/:id/logs", async (request, reply) => {
    const userId = await requireUserId(request);
    if (!userId) {
      return reply.code(401).send({ error: "Unauthorized" });
    }

    const { id } = request.params as { id: string };
    const tail = Number((request.query as { tail?: string }).tail ?? "200");

    const deployment = await prisma.deployment.findUnique({ where: { id } });
    if (!deployment) {
      return reply.code(404).send({ error: "Deployment not found." });
    }

    const logs = await agentProvider.logs(deployment.instanceId, Number.isFinite(tail) ? tail : 200);
    return reply.send(logs);
  });
};
