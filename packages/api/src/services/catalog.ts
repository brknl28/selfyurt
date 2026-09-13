import { promises as fs } from "node:fs";
import path from "node:path";

import yaml from "js-yaml";

import { env } from "../env.js";

export type CatalogIndexEntry = {
  id: string;
  name: string;
  category: string;
  manifest: string;
};

export type EnvSchemaField = {
  key: string;
  label: string;
  required: boolean;
  default?: string;
  secret?: boolean;
};

export type AppManifest = {
  id: string;
  name: string;
  description: string;
  category: string;
  icon?: string;
  compose: {
    template: string;
    variables?: Array<{ key: string; required?: boolean }>;
  };
  ingress: {
    targetService: string;
    targetPort: number;
  };
  access?: {
    defaultExposePublic?: boolean;
    supportsPublic?: boolean;
    protocol?: "http" | "tcp";
  };
  envSchema: EnvSchemaField[];
  volumes: Array<{
    name: string;
    mountPath: string;
    keepOnUninstall?: boolean;
  }>;
  notes?: string;
};

function resolveCatalogDir(): string {
  if (env.CATALOG_DIR) {
    return env.CATALOG_DIR;
  }

  return path.resolve(process.cwd(), "../../apps/catalog");
}

export async function loadCatalogIndex(): Promise<CatalogIndexEntry[]> {
  const catalogDir = resolveCatalogDir();
  const indexPath = path.join(catalogDir, "index.json");
  const data = await fs.readFile(indexPath, "utf8");
  return JSON.parse(data) as CatalogIndexEntry[];
}

export async function loadManifestByEntry(entry: CatalogIndexEntry): Promise<AppManifest> {
  const catalogDir = resolveCatalogDir();
  const manifestPath = path.join(catalogDir, entry.manifest);
  const raw = await fs.readFile(manifestPath, "utf8");

  const parsed = yaml.load(raw) as AppManifest;
  const supportsPublic = parsed.access?.supportsPublic ?? true;
  const defaultExposePublic = parsed.access?.defaultExposePublic ?? supportsPublic;
  const protocol = parsed.access?.protocol ?? "http";

  return {
    ...parsed,
    access: {
      supportsPublic,
      defaultExposePublic,
      protocol
    },
    envSchema: parsed.envSchema ?? [],
    volumes: parsed.volumes ?? []
  };
}

export async function getCatalogWithManifests(): Promise<
  Array<CatalogIndexEntry & { manifestData: AppManifest }>
> {
  const index = await loadCatalogIndex();

  const withManifests = await Promise.all(
    index.map(async (entry) => ({
      ...entry,
      manifestData: await loadManifestByEntry(entry)
    }))
  );

  return withManifests;
}

export async function findManifestByAppId(appId: string): Promise<AppManifest | null> {
  const index = await loadCatalogIndex();
  const found = index.find((entry) => entry.id === appId);
  if (!found) {
    return null;
  }

  return loadManifestByEntry(found);
}
