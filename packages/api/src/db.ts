import { PrismaClient } from "@prisma/client";

declare global {
  // eslint-disable-next-line no-var
  var __selfyurtPrisma: PrismaClient | undefined;
}

export const prisma =
  global.__selfyurtPrisma ??
  new PrismaClient({
    log: ["warn", "error"]
  });

if (process.env.NODE_ENV !== "production") {
  global.__selfyurtPrisma = prisma;
}
