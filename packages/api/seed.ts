import { prisma } from "./src/db.js";

async function seed() {
  const existingCount = await prisma.deployment.count();
  if (existingCount === 0) {
    console.log("Seeding dummy deployments...");
    await prisma.deployment.create({
      data: {
        appId: "nginx-hello",
        instanceId: "hello-sample",
        hostname: "hello.local.test",
        exposePublic: true,
        accessType: "PUBLIC",
        status: "RUNNING",
        envJson: "{}",
        version: "latest",
      },
    });

    await prisma.deployment.create({
      data: {
        appId: "postgres",
        instanceId: "pg-sample",
        exposePublic: false,
        accessType: "INTERNAL",
        internalEndpoint: "pg-sample:5432",
        status: "RUNNING",
        envJson: JSON.stringify({
          POSTGRES_USER: "postgres",
          POSTGRES_PASSWORD: "secretpassword",
          POSTGRES_DB: "app_db"
        }),
        version: "16-alpine",
      },
    });
    
    console.log("Seed completed!");
  } else {
    console.log("Deployments already exist, skipping seed.");
  }
}

seed().catch(console.error).finally(() => prisma.$disconnect());
