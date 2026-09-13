import { prisma } from "../db.js";

const ddlStatements = [
  `CREATE TABLE IF NOT EXISTS "User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
  );`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "User_email_key" ON "User"("email");`,
  `CREATE TABLE IF NOT EXISTS "Settings" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "baseDomain" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
  );`,
  `CREATE TABLE IF NOT EXISTS "Deployment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "appId" TEXT NOT NULL,
    "instanceId" TEXT NOT NULL,
    "hostname" TEXT,
    "exposePublic" BOOLEAN NOT NULL DEFAULT 1,
    "accessType" TEXT NOT NULL DEFAULT 'PUBLIC',
    "internalEndpoint" TEXT,
    "status" TEXT NOT NULL DEFAULT 'DEPLOYING',
    "envJson" TEXT NOT NULL,
    "version" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
  );`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "Deployment_instanceId_key" ON "Deployment"("instanceId");`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "Deployment_hostname_key" ON "Deployment"("hostname");`,
  `CREATE TABLE IF NOT EXISTS "Route" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "hostname" TEXT NOT NULL,
    "deploymentId" TEXT NOT NULL,
    "target" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY ("deploymentId") REFERENCES "Deployment" ("id") ON DELETE CASCADE ON UPDATE CASCADE
  );`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "Route_hostname_key" ON "Route"("hostname");`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "Route_deploymentId_key" ON "Route"("deploymentId");`,
  `CREATE TABLE IF NOT EXISTS "AuditLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "action" TEXT NOT NULL,
    "payloadJson" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
  );`
];

async function getTableColumns(tableName: string): Promise<Array<{ name: string; notnull: number }>> {
  return (await prisma.$queryRawUnsafe(`PRAGMA table_info("${tableName}")`)) as Array<{
    name: string;
    notnull: number;
  }>;
}

async function rebuildDeploymentTableForAccessMode(): Promise<void> {
  await prisma.$executeRawUnsafe(`PRAGMA foreign_keys=OFF;`);

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "new_Deployment" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "appId" TEXT NOT NULL,
      "instanceId" TEXT NOT NULL,
      "hostname" TEXT,
      "exposePublic" BOOLEAN NOT NULL DEFAULT 1,
      "accessType" TEXT NOT NULL DEFAULT 'PUBLIC',
      "internalEndpoint" TEXT,
      "status" TEXT NOT NULL DEFAULT 'DEPLOYING',
      "envJson" TEXT NOT NULL,
      "version" TEXT,
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" DATETIME NOT NULL
    );
  `);

  await prisma.$executeRawUnsafe(`
    INSERT INTO "new_Deployment" (
      "id",
      "appId",
      "instanceId",
      "hostname",
      "exposePublic",
      "accessType",
      "internalEndpoint",
      "status",
      "envJson",
      "version",
      "createdAt",
      "updatedAt"
    )
    SELECT
      "id",
      "appId",
      "instanceId",
      "hostname",
      1,
      'PUBLIC',
      NULL,
      "status",
      "envJson",
      "version",
      "createdAt",
      "updatedAt"
    FROM "Deployment";
  `);

  await prisma.$executeRawUnsafe(`DROP TABLE "Deployment";`);
  await prisma.$executeRawUnsafe(`ALTER TABLE "new_Deployment" RENAME TO "Deployment";`);

  await prisma.$executeRawUnsafe(
    `CREATE UNIQUE INDEX IF NOT EXISTS "Deployment_instanceId_key" ON "Deployment"("instanceId");`
  );
  await prisma.$executeRawUnsafe(
    `CREATE UNIQUE INDEX IF NOT EXISTS "Deployment_hostname_key" ON "Deployment"("hostname");`
  );

  await prisma.$executeRawUnsafe(`PRAGMA foreign_keys=ON;`);
}

async function ensureDeploymentAccessColumns(): Promise<void> {
  const columns = await getTableColumns("Deployment");
  if (columns.length === 0) {
    return;
  }

  const hasExposePublic = columns.some((column) => column.name === "exposePublic");
  const hasAccessType = columns.some((column) => column.name === "accessType");
  const hasInternalEndpoint = columns.some((column) => column.name === "internalEndpoint");
  const hostnameColumn = columns.find((column) => column.name === "hostname");
  const hostnameIsNonNullable = (hostnameColumn?.notnull ?? 0) === 1;

  if (hasExposePublic && hasAccessType && hasInternalEndpoint && !hostnameIsNonNullable) {
    return;
  }

  await rebuildDeploymentTableForAccessMode();
}

export async function ensureSchema(): Promise<void> {
  for (const statement of ddlStatements) {
    await prisma.$executeRawUnsafe(statement);
  }

  await ensureDeploymentAccessColumns();
}
