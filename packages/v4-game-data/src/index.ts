import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

export const V4_GAME_VERSION = "2.8.2";

export const REQUIRED_V4_TABLES = [
  "MainBattleLibrary",
  "EnemyAgeScalingLibrary",
  "EnemyLibrary",
  "WeaponLibrary",
  "ProjectilesLibrary",
  "MainBattleConfig",
  "ItemBalancingConfig",
  "StatConfigLibrary",
  "SecondaryStatLibrary",
  "SkillLibrary",
  "SkillBaseConfig",
  "MountLibrary",
  "PvpBaseConfig"
] as const;

export type RequiredV4Table = typeof REQUIRED_V4_TABLES[number];

export type V4TableManifest = {
  archiveEntry: string;
  entryChecksum: string;
  file: string;
  fileSha256: string;
  fileSize: number;
  payloadSha256: string;
  payloadSize: number;
  normalizedFile?: string;
  normalizedFileSha256?: string;
  normalizedFileSize?: number;
  normalizedShape?: "array" | "object";
};

export type V4GameDataManifest = {
  schemaVersion: number;
  gameVersion: string;
  format: string;
  normalizedFormat: string;
  fixedPointScales: { F1D: number; F64: number };
  source: {
    asset: string;
    archiveChecksum: string;
    archiveVersion: number;
    createdAt: string;
    sha256: string;
  };
  requiredTables: string[];
  optionalTablesIncluded: string[];
  tables: Record<string, V4TableManifest>;
};

export type V4GameData = {
  version: string;
  manifest: V4GameDataManifest;
  tables: Record<string, unknown>;
  wire: Record<string, unknown>;
};

export function loadV4GameData(
  dataDir = defaultDataDir(),
  expectedVersion = V4_GAME_VERSION
): V4GameData {
  const manifest = readJson(join(dataDir, "manifest.json")) as V4GameDataManifest;
  validateManifest(manifest, expectedVersion);

  const wire: Record<string, unknown> = {};
  for (const [tableName, table] of Object.entries(manifest.tables)) {
    wire[tableName] = readVerifiedJson(dataDir, table.file, table.fileSize, table.fileSha256, tableName);
  }

  const tables = Object.fromEntries(Object.entries(manifest.tables).flatMap(([tableName, table]) => {
    if (!table.normalizedFile || !table.normalizedFileSha256 || table.normalizedFileSize === undefined) return [];
    return [[tableName, readVerifiedJson(
      dataDir,
      table.normalizedFile,
      table.normalizedFileSize,
      table.normalizedFileSha256,
      `${tableName} normalized`
    )]];
  }));

  return { version: manifest.gameVersion, manifest, tables, wire };
}

function validateManifest(manifest: V4GameDataManifest, expectedVersion: string) {
  if (manifest.schemaVersion !== 2) throw new Error("unsupported v4 game-data manifest");
  if (manifest.gameVersion !== expectedVersion) {
    throw new Error(`unsupported game version: ${manifest.gameVersion}`);
  }
  for (const tableName of REQUIRED_V4_TABLES) {
    const table = manifest.tables[tableName];
    if (!manifest.requiredTables.includes(tableName) || !table) {
      throw new Error(`missing required v4 game-data table: ${tableName}`);
    }
    if (!table.normalizedFile || !table.normalizedFileSha256 || table.normalizedFileSize === undefined) {
      throw new Error(`missing normalized v4 game-data table: ${tableName}`);
    }
  }
}

function readVerifiedJson(
  dataDir: string,
  relativePath: string,
  expectedSize: number,
  expectedHash: string,
  label: string
): unknown {
  const content = readFileSync(join(dataDir, ...relativePath.split("/")));
  if (content.length !== expectedSize || sha256(content) !== expectedHash) {
    throw new Error(`v4 game-data checksum mismatch: ${label}`);
  }
  return JSON.parse(content.toString("utf8"));
}

function defaultDataDir(): string {
  return fileURLToPath(new URL(`../data/${V4_GAME_VERSION}/`, import.meta.url));
}

function readJson(path: string): unknown {
  return JSON.parse(readFileSync(path, "utf8"));
}

function sha256(value: Buffer): string {
  return createHash("sha256").update(value).digest("hex").toUpperCase();
}
