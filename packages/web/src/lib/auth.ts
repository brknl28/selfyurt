import { redirect } from "@tanstack/react-router";

import { api } from "./api";

export async function requireAuth() {
  try {
    const result = await api.me();
    return result.user;
  } catch {
    throw redirect({ to: "/login" });
  }
}

export async function redirectIfAuthenticated() {
  const isAuthenticated = await api
    .me()
    .then(() => true)
    .catch(() => false);

  if (isAuthenticated) {
    throw redirect({ to: "/dashboard" });
  }

  return null;
}
