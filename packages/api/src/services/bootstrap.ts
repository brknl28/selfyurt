import { prisma } from "../db.js";
import { env } from "../env.js";
import { hashPassword } from "../auth/password.js";

export async function bootstrapData(): Promise<void> {
  await prisma.settings.upsert({
    where: { id: "singleton" },
    update: {
      baseDomain: env.BASE_DOMAIN || null
    },
    create: {
      id: "singleton",
      baseDomain: env.BASE_DOMAIN || null
    }
  });

  const existingUser = await prisma.user.findFirst();
  if (!existingUser) {
    const passwordHash = await hashPassword(env.ADMIN_PASSWORD);

    await prisma.user.create({
      data: {
        email: env.ADMIN_EMAIL.toLowerCase(),
        passwordHash
      }
    });
  }
}
