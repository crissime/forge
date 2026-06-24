import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  DEFAULT_GAME_DATA_VERSION,
  CURATED_GAME_DATA_FILES,
  RAW_GAME_DATA_FILES,
  ROOT_GAME_DATA_FILES,
  normalizeGameData,
  sha256,
  type GameDataManifest,
  type RawGameDataFile
} from "../src/index.js";

const version = process.argv[2] || process.env.GAME_DATA_VERSION || DEFAULT_GAME_DATA_VERSION;
const sourceRepo = process.env.GAME_DATA_SOURCE_REPO || "https://github.com/1vcian/fm";
const sourceRef = process.env.GAME_DATA_SOURCE_REF || "main";
const rawBase = `https://raw.githubusercontent.com/1vcian/fm/${sourceRef}/public/parsed_configs`;
const repoRoot = process.env.INIT_CWD || process.cwd();
const outRoot = path.resolve(repoRoot, "packages", "game-data", "data", version);

async function downloadJson(file: RawGameDataFile): Promise<{ sourceUrl: string; text: string; json: any }> {
  const sourceUrl = ROOT_GAME_DATA_FILES.includes(file as any)
    ? `${rawBase}/${file}`
    : `${rawBase}/${version}/${file}`;
  const response = await fetch(sourceUrl);
  if (!response.ok) throw new Error(`Cannot fetch ${sourceUrl}: ${response.status} ${response.statusText}`);
  const text = await response.text();
  return { sourceUrl, text, json: JSON.parse(text) };
}

async function main() {
  await mkdir(path.join(outRoot, "raw"), { recursive: true });
  const raw: Partial<Record<RawGameDataFile, any>> = {};
  const files: GameDataManifest["files"] = [];

  for (const file of [...RAW_GAME_DATA_FILES, ...ROOT_GAME_DATA_FILES]) {
    const result = await downloadJson(file);
    raw[file] = result.json;
    await writeFile(path.join(outRoot, "raw", file), `${JSON.stringify(result.json, null, 2)}\n`, "utf8");
    files.push({
      file,
      sourceUrl: result.sourceUrl,
      sha256: sha256(result.text),
      bytes: Buffer.byteLength(result.text)
    });
  }

  for (const file of CURATED_GAME_DATA_FILES) {
    const localPath = path.resolve(repoRoot, "packages", "game-data", "curated", file);
    const text = await readFile(localPath, "utf8");
    raw[file] = JSON.parse(text);
    await writeFile(path.join(outRoot, "raw", file), `${JSON.stringify(raw[file], null, 2)}\n`, "utf8");
    files.push({
      file,
      sourceUrl: String(raw[file]?.sourceUrl || `curated:${file}`),
      sha256: sha256(text),
      bytes: Buffer.byteLength(text)
    });
  }

  const normalized = normalizeGameData(version, raw);
  const manifest: GameDataManifest = {
    version,
    sourceRepo,
    sourceRef,
    generatedAt: new Date().toISOString(),
    files
  };

  await writeFile(path.join(outRoot, "normalized.json"), `${JSON.stringify(normalized, null, 2)}\n`, "utf8");
  await writeFile(path.join(outRoot, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  console.log(`Game data ${version} written to ${outRoot}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
