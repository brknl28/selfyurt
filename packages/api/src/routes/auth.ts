import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";

import { prisma } from "../db.js";
import { verifyPassword } from "../auth/password.js";
import { clearSessionCookie, getSessionUserId, setSessionCookie } from "../auth/session.js";

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1)
});

export const authRoutes: FastifyPluginAsync = async (app) => {
  app.post("/auth/login", async (request, reply) => {
    const parsed = loginSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: "Invalid request payload." });
    }

    const email = parsed.data.email.toLowerCase();
    const user = await prisma.user.findUnique({ where: { email } });

    if (!user) {
      return reply.code(401).send({ error: "Invalid credentials." });
    }

    const passwordValid = await verifyPassword(parsed.data.password, user.passwordHash);
    if (!passwordValid) {
      return reply.code(401).send({ error: "Invalid credentials." });
    }

    setSessionCookie(reply, user.id);
    return reply.send({
      user: {
        id: user.id,
        email: user.email,
        createdAt: user.createdAt
      }
    });
  });

  app.post("/auth/logout", async (_request, reply) => {
    clearSessionCookie(reply);
    return reply.send({ ok: true });
  });

  app.get("/auth/me", async (request, reply) => {
    const sessionUserId = getSessionUserId(request);
    if (!sessionUserId) {
      return reply.code(401).send({ error: "Unauthorized" });
    }

    const user = await prisma.user.findUnique({
      where: { id: sessionUserId },
      select: { id: true, email: true, createdAt: true }
    });

    if (!user) {
      clearSessionCookie(reply);
      return reply.code(401).send({ error: "Unauthorized" });
    }

    return reply.send({ user });
  });
};
