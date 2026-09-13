import type { FastifyReply, FastifyRequest } from "fastify";

import { env } from "../env.js";

export const SESSION_COOKIE_NAME = "selfyurt_session";

export function setSessionCookie(reply: FastifyReply, userId: string): void {
  reply.setCookie(SESSION_COOKIE_NAME, userId, {
    path: "/",
    httpOnly: true,
    signed: true,
    secure: env.COOKIE_SECURE,
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 14
  });
}

export function clearSessionCookie(reply: FastifyReply): void {
  reply.clearCookie(SESSION_COOKIE_NAME, {
    path: "/",
    httpOnly: true,
    secure: env.COOKIE_SECURE,
    signed: true,
    sameSite: "lax"
  });
}

export function getSessionUserId(request: FastifyRequest): string | null {
  const signedValue = request.cookies[SESSION_COOKIE_NAME];
  if (!signedValue) {
    return null;
  }

  const unsigned = request.unsignCookie(signedValue);
  if (!unsigned.valid || typeof unsigned.value !== "string") {
    return null;
  }

  return unsigned.value;
}
