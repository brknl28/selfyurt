PRAGMA foreign_keys=OFF;

CREATE TABLE "new_Deployment" (
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

DROP TABLE "Deployment";
ALTER TABLE "new_Deployment" RENAME TO "Deployment";

CREATE UNIQUE INDEX "Deployment_instanceId_key" ON "Deployment"("instanceId");
CREATE UNIQUE INDEX "Deployment_hostname_key" ON "Deployment"("hostname");

PRAGMA foreign_keys=ON;
